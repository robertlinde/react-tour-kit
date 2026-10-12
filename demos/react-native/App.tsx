import {type ComponentRef, createContext, createRef, type ReactNode, use, useState, useSyncExternalStore} from 'react';
import {StatusBar} from 'expo-status-bar';
import {FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommonActions, createNavigationContainerRef, NavigationContainer, StackActions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  TourHost,
  TourProvider,
  type TourStep,
  type TourTheme,
  type TourTooltipProps,
  useTour,
  useTourScrollView,
  useTourTarget,
} from '@robertlinde/react-tour-kit/react-native';

type Screens = {
  Home: undefined;
  Settings: undefined;
  Help: undefined;
};

const Stack = createNativeStackNavigator<Screens>();
const navigation = createNavigationContainerRef<Screens>();
/** The home screen's scroll view: the Home tab scrolls it back to the top. */
const homeScroll = createRef<ComponentRef<typeof ScrollView>>();

/** Shows `screen`: goes back to it when it is already open, otherwise opens it. Safe to call repeatedly. */
function show(screen: keyof Screens): void {
  if (!navigation.isReady() || navigation.getCurrentRoute()?.name === screen) {
    return;
  }

  const isOpen = navigation.getRootState()?.routes.some((route) => route.name === screen) ?? false;
  navigation.dispatch(isOpen ? StackActions.popTo(screen) : CommonActions.navigate(screen));
}

/**
 * The demo tour. Every step shows its own screen first, so it works in both directions (Next and
 * Back). The tour waits for the target to appear; no delays needed.
 */
function on(screen: keyof Screens, step: TourStep): TourStep {
  return {
    ...step,
    onBeforeStep() {
      show(screen);
    },
  };
}

type Order = {readonly id: number; readonly table: string; readonly items: string};
type OrdersState = {readonly orders: readonly Order[]; readonly isLoading: boolean};

const sampleOrders: readonly Order[] = [
  {id: 1, table: 'Table 4', items: '2 × Pasta, 1 × Salad'},
  {id: 2, table: 'Table 7', items: '3 × Pizza'},
  {id: 3, table: 'Terrace 2', items: '1 × Soup, 2 × Lemonade'},
];

/** How long the demo's "server" takes to answer. */
const ordersServerMs = 1500;

/** Recent orders, as if from a server: refreshing them takes a moment. */
let ordersState: OrdersState = {orders: sampleOrders, isLoading: false};
const ordersListeners = new Set<() => void>();

function setOrdersState(next: OrdersState): void {
  ordersState = next;
  for (const listener of ordersListeners) {
    listener();
  }
}

function subscribeToOrders(listener: () => void): () => void {
  ordersListeners.add(listener);
  return () => {
    ordersListeners.delete(listener);
  };
}

/** Loads the orders again; resolves once they are there. */
async function refreshOrders(): Promise<void> {
  setOrdersState({...ordersState, isLoading: true});
  await new Promise((resolve) => {
    setTimeout(resolve, ordersServerMs);
  });
  setOrdersState({orders: sampleOrders, isLoading: false});
}

function useOrders(): OrdersState {
  return useSyncExternalStore(
    subscribeToOrders,
    () => ordersState,
    () => ordersState,
  );
}

const demoTour: TourStep[] = [
  on('Home', {
    target: 'header',
    title: 'Welcome to react-tour-kit',
    content: 'A guided tour across screens, lists and modals. Use Next and Back, or tap outside to close.',
  }),
  on('Home', {
    target: 'nav-settings',
    title: 'Highlight anything',
    content: 'Any view registered with useTourTarget can be a step, including navigation elements.',
  }),
  on('Home', {
    target: 'feature-1',
    title: 'Smart placement',
    content: 'The tooltip picks the side with room and never leaves the safe area.',
    placement: 'top',
  }),
  {
    target: 'orders',
    title: 'Waits for your data',
    content: 'onBeforeStep refreshed these orders first. While that took a moment, the tour showed a spinner.',
    async onBeforeStep() {
      show('Home');
      await refreshOrders();
    },
  },
  on('Home', {
    target: 'integration-last',
    title: 'Horizontal lists',
    content: 'Targets at the end of a horizontal FlatList are scrolled into view.',
  }),
  on('Home', {
    target: 'install',
    title: 'Below the fold',
    content: 'Scroll views registered with useTourScrollView are scrolled for you.',
  }),
  on('Settings', {
    target: 'settings-header',
    title: 'Across screens',
    content: 'Steps can live on other screens: onBeforeStep navigates, the tour waits for the target.',
  }),
  on('Settings', {
    target: 'advanced',
    title: 'Long lists',
    content: 'Deep in a scrolling list, still found and brought into view.',
  }),
  on('Help', {
    target: 'help-card',
    title: 'Modal screens',
    content: 'Add <TourHost /> to a modal screen and the tour is drawn on top of it.',
  }),
  on('Home', {
    target: 'cta-button',
    title: "That's it!",
    content: 'Wrap your app in TourProvider and call startTour. Have fun!',
    placement: 'top',
  }),
];

const darkTheme: TourTheme = {
  primaryColor: '#8b5cf6',
  tooltipBackground: '#1f2937',
  titleColor: '#f9fafb',
  contentColor: '#d1d5db',
  overlayColor: 'rgba(0, 0, 0, 0.7)',
};

/** A custom tooltip: only the content; the tour positions, animates and focuses it. */
function CompactTooltip({step, currentStep, totalSteps, onNext, onPrev, onClose}: TourTooltipProps): ReactNode {
  const isLast = currentStep === totalSteps - 1;
  return (
    <View style={styles.compact}>
      <Text style={styles.compactTitle} role="heading">
        {step.title}
      </Text>
      <Text style={styles.compactText}>{step.content}</Text>
      <View style={styles.compactActions}>
        <Pressable accessibilityRole="button" onPress={onClose}>
          <Text style={styles.compactLink}>Skip</Text>
        </Pressable>
        <Text style={styles.compactCount}>
          {currentStep + 1}/{totalSteps}
        </Text>
        <Pressable accessibilityRole="button" disabled={currentStep === 0} onPress={onPrev}>
          <Text style={[styles.compactLink, currentStep === 0 && styles.disabled]}>Back</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onNext}>
          <Text style={styles.compactLink}>{isLast ? 'Done' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

type Settings = {
  readonly isCompact: boolean;
  readonly setIsCompact: (value: boolean) => void;
};

const SettingsContext = createContext<Settings>({isCompact: false, setIsCompact() {}});

function TabBar(): ReactNode {
  const insets = useSafeAreaInsets();
  const homeRef = useTourTarget('nav-home');
  const settingsRef = useTourTarget('nav-settings');

  return (
    <View style={[styles.tabBar, {paddingTop: insets.top + 8}]}>
      <Pressable
        ref={homeRef}
        testID="tab-home"
        accessibilityRole="button"
        style={styles.tabButton}
        onPress={() => {
          show('Home');
          homeScroll.current?.scrollTo({y: 0, animated: true});
        }}
      >
        <Text style={styles.tabButtonText}>Home</Text>
      </Pressable>
      <Pressable
        ref={settingsRef}
        testID="tab-settings"
        accessibilityRole="button"
        style={styles.tabButton}
        onPress={() => {
          show('Settings');
        }}
      >
        <Text style={styles.tabButtonText}>Settings</Text>
      </Pressable>
      <Pressable
        testID="tab-help"
        accessibilityRole="button"
        style={styles.tabButton}
        onPress={() => {
          show('Help');
        }}
      >
        <Text style={styles.tabButtonText}>Help</Text>
      </Pressable>
    </View>
  );
}

function FeatureCard({
  tourId,
  icon,
  title,
  description,
}: {
  readonly tourId: string;
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}): ReactNode {
  const ref = useTourTarget(tourId);
  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{description}</Text>
    </View>
  );
}

const integrations = [
  'Expo',
  'React Navigation',
  'Reanimated',
  'Gesture Handler',
  'Safe Area',
  'Screens',
  'Skia',
  'Analytics',
];

function Integration({name, isLast}: {readonly name: string; readonly isLast: boolean}): ReactNode {
  // Every card registers; only the last one is used by the tour.
  const ref = useTourTarget(isLast ? 'integration-last' : `integration-${name}`);
  return (
    <View ref={ref} style={styles.integration}>
      <Text style={styles.cardTitle}>{name}</Text>
    </View>
  );
}

function Integrations(): ReactNode {
  const listRef = useTourScrollView<FlatList<string>>();
  return (
    <FlatList
      ref={listRef}
      horizontal
      data={integrations}
      keyExtractor={(name) => name}
      contentContainerStyle={styles.integrations}
      showsHorizontalScrollIndicator={false}
      renderItem={({item, index}) => <Integration name={item} isLast={index === integrations.length - 1} />}
    />
  );
}

function RecentOrders(): ReactNode {
  const ref = useTourTarget('orders');
  const {orders, isLoading} = useOrders();
  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.cardTitle}>Recent orders{isLoading ? ' · updating…' : ''}</Text>
      {orders.map((order) => (
        <Text key={order.id} style={styles.cardText}>
          <Text style={styles.orderTable}>{order.table}</Text> {order.items}
        </Text>
      ))}
    </View>
  );
}

function HomeScreen(): ReactNode {
  const {startTour, isActive, currentStep, steps} = useTour();
  // A ref the app already has: pass it in.
  const scrollRef = useTourScrollView(homeScroll);
  const headerRef = useTourTarget('header');
  const ctaRef = useTourTarget('cta-button');
  const installRef = useTourTarget('install');
  const insets = useSafeAreaInsets();

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={{paddingBottom: insets.bottom + 24}}>
      <View ref={headerRef} style={styles.header}>
        <Text style={styles.headerTitle}>react-tour-kit</Text>
        <Text style={styles.headerSubtitle}>Guided tours for React and React Native that never leave the screen</Text>
      </View>

      <View style={styles.main}>
        <Pressable
          ref={ctaRef}
          accessibilityRole="button"
          style={styles.ctaButton}
          onPress={() => {
            startTour(demoTour, 'demo');
          }}
        >
          <Text style={styles.ctaButtonText}>
            {isActive ? `Step ${currentStep + 1} of ${steps.length}` : 'Start the tour'}
          </Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Features</Text>
        <FeatureCard
          tourId="feature-1"
          icon="🚀"
          title="Simple"
          description="Wrap your app in TourProvider, call startTour from useTour. That's the whole API."
        />
        <FeatureCard
          tourId="feature-2"
          icon="🎯"
          title="Always in sight"
          description="Targets are scrolled into view; the tooltip stays inside the safe area."
        />
        <FeatureCard
          tourId="feature-3"
          icon="♿"
          title="Accessible"
          description="Screen-reader focus moves to the tooltip, the back button closes the tour."
        />

        <RecentOrders />

        <Text style={styles.sectionTitle}>Integrations</Text>
      </View>
      <Integrations />

      <View style={styles.main}>
        <View style={styles.spacer} />
        <View ref={installRef} style={styles.card}>
          <Text style={styles.cardTitle}>Installation</Text>
          <Text style={styles.code}>npm i @robertlinde/react-tour-kit</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function SettingsScreen(): ReactNode {
  const {isCompact, setIsCompact} = use(SettingsContext);
  const scrollRef = useTourScrollView();
  const headerRef = useTourTarget('settings-header');
  const advancedRef = useTourTarget('advanced');
  const insets = useSafeAreaInsets();

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={{paddingBottom: insets.bottom + 24}}>
      <View ref={headerRef} style={[styles.header, styles.settingsHeader]}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Configure your preferences</Text>
      </View>

      <View style={styles.main}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.cardTitle}>Compact tooltip</Text>
            <Text style={styles.cardText}>Use a custom tooltip component</Text>
          </View>
          <Switch testID="compact-switch" value={isCompact} onValueChange={setIsCompact} />
        </View>

        {Array.from({length: 12}, (_, index) => (
          <View key={index} style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.cardTitle}>Option {index + 1}</Text>
              <Text style={styles.cardText}>A setting you rarely need</Text>
            </View>
          </View>
        ))}

        <View ref={advancedRef} style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.cardTitle}>Experimental features</Text>
            <Text style={styles.cardText}>At the end of a long list</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function HelpScreen(): ReactNode {
  const cardRef = useTourTarget('help-card');
  return (
    <View style={[styles.screen, styles.help]}>
      <View ref={cardRef} style={styles.card}>
        <Text style={styles.cardTitle}>Need help?</Text>
        <Text style={styles.cardText}>This screen is presented as a native modal, above the rest of the app.</Text>
      </View>
      {/* Tours can highlight views in this modal: the tour is drawn here while the screen is open. */}
      <TourHost />
    </View>
  );
}

function Root(): ReactNode {
  const insets = useSafeAreaInsets();
  const [isCompact, setIsCompact] = useState(false);

  return (
    <SettingsContext value={{isCompact, setIsCompact}}>
      <TourProvider
        insets={insets}
        theme={darkTheme}
        TooltipComponent={isCompact ? CompactTooltip : undefined}
        onTourEnd={(tourId, info) => {
          console.info('Tour ended', tourId, info.reason, `at step ${info.stepIndex + 1} of ${info.totalSteps}`);
        }}
      >
        <NavigationContainer ref={navigation}>
          <StatusBar style="light" />
          {/* The tab bar is each screen's header; the modal screen has none and covers it. */}
          <Stack.Navigator screenOptions={{header: () => <TabBar />, animation: 'fade'}}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="Help"
              component={HelpScreen}
              options={{presentation: 'modal', animation: 'default', headerShown: false}}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </TourProvider>
    </SettingsContext>
  );
}

export default function App(): ReactNode {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111827',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
    justifyContent: 'center',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#1f2937',
  },
  tabButtonText: {
    color: '#d1d5db',
    fontWeight: '500',
  },
  header: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#4f46e5',
  },
  settingsHeader: {
    backgroundColor: '#7c3aed',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  main: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f9fafb',
    marginTop: 8,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  orderTable: {
    fontWeight: '600',
    color: '#f9fafb',
  },
  integrations: {
    gap: 12,
    paddingHorizontal: 24,
  },
  integration: {
    width: 160,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    height: 600,
  },
  code: {
    marginTop: 8,
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#86efac',
  },
  ctaButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    alignItems: 'center',
    marginVertical: 24,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  settingRow: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  help: {
    padding: 24,
    justifyContent: 'center',
  },
  compact: {
    padding: 14,
    gap: 6,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  compactText: {
    fontSize: 13,
    color: '#d1d5db',
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  compactLink: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  compactCount: {
    flex: 1,
    textAlign: 'center',
    color: '#9ca3af',
  },
  disabled: {
    opacity: 0.4,
  },
});
