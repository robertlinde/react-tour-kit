import React from 'react';
import {StatusBar} from 'expo-status-bar';
import {StyleSheet, Text, View, TouchableOpacity, ScrollView} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {NavigationContainer, useNavigation} from '@react-navigation/native';
import {createNativeStackNavigator, type NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TourProvider, useTour, useTourTarget, type TourStep} from 'react-tour-kit/react-native';

type RootStackParameterList = {
  Home: undefined;
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParameterList>;

const Stack = createNativeStackNavigator<RootStackParameterList>();

// Tour steps that span multiple screens
const createTourSteps = (navigate: (screen: keyof RootStackParameterList) => void): TourStep[] => [
  {
    target: 'header',
    title: 'Welcome to React Tour!',
    content: 'This demo showcases cross-screen tours in React Native.',
    placement: 'bottom',
  },
  {
    target: 'nav-home',
    title: 'Navigation',
    content: 'Use these tabs to navigate between screens.',
    placement: 'bottom',
  },
  {
    target: 'feature-1',
    title: 'Easy to Use',
    content: 'Register targets with useTourTarget, reference by string ID.',
    placement: 'bottom',
  },
  {
    target: 'nav-settings',
    title: "Let's Visit Settings",
    content: "Now we'll navigate to Settings to continue the tour.",
    placement: 'bottom',
    async onBeforeStep() {
      navigate('Settings');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 300);
      });
    },
  },
  {
    target: 'settings-header',
    title: 'Settings Screen',
    content: "We've navigated to a different screen! The tour continues seamlessly.",
    placement: 'bottom',
  },
  {
    target: 'theme-toggle',
    title: 'Theme Settings',
    content: 'Tours can highlight elements on any screen in your app.',
    placement: 'bottom',
  },
  {
    target: 'nav-home',
    title: 'Back to Home',
    content: "Let's go back to the home screen to finish up.",
    placement: 'bottom',
    async onBeforeStep() {
      navigate('Home');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 300);
      });
    },
  },
  {
    target: 'cta-button',
    title: "That's It!",
    content: "You've completed a cross-screen tour. TourProvider wraps your navigator.",
    placement: 'top',
  },
];

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
}): React.JSX.Element {
  const ref = useTourTarget<View>(tourId);

  return (
    <View ref={ref} style={styles.featureCard}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
}

function TabBar(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const homeRef = useTourTarget<View>('nav-home');
  const settingsRef = useTourTarget<View>('nav-settings');

  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        ref={homeRef}
        style={styles.tabButton}
        onPress={() => {
          navigation.navigate('Home');
        }}
      >
        <Text style={styles.tabButtonText}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        ref={settingsRef}
        style={styles.tabButton}
        onPress={() => {
          navigation.navigate('Settings');
        }}
      >
        <Text style={styles.tabButtonText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

function HomeScreen(): React.JSX.Element {
  const {startTour, isActive, currentStep, steps} = useTour();
  const navigation = useNavigation<NavigationProp>();
  const headerRef = useTourTarget<View>('header');
  const ctaRef = useTourTarget<View>('cta-button');

  const handleStartTour = (): void => {
    navigation.navigate('Home');
    setTimeout(() => {
      startTour(
        createTourSteps((screen) => {
          navigation.navigate(screen);
        }),
        'cross-screen-tour',
      );
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View ref={headerRef} style={styles.header}>
          <Text style={styles.headerTitle}>react-tour-kit</Text>
          <Text style={styles.headerSubtitle}>A flexible, customizable tour component for React Native</Text>
        </View>

        <View style={styles.main}>
          <Text style={styles.sectionTitle}>Features</Text>

          <FeatureCard
            tourId="feature-1"
            icon="🚀"
            title="Easy to Use"
            description="Simple API with TourProvider and useTour hook. Register targets with useTourTarget."
          />

          <FeatureCard
            tourId="feature-2"
            icon="🎨"
            title="Customizable"
            description="Theme support, custom tooltip and overlay components. Make it match your brand."
          />

          <FeatureCard
            tourId="feature-3"
            icon="📱"
            title="Cross-Platform"
            description="Works with React (web) and React Native. One API, multiple platforms."
          />

          <TouchableOpacity ref={ctaRef} style={styles.ctaButton} onPress={handleStartTour}>
            <Text style={styles.ctaButtonText}>
              {isActive ? `Step ${currentStep + 1} of ${steps.length}` : 'Start Cross-Screen Tour'}
            </Text>
          </TouchableOpacity>

          <View style={styles.installSection}>
            <Text style={styles.installTitle}>Installation</Text>
            <View style={styles.installCode}>
              <Text style={styles.installCodeText}>npm install react-tour-kit</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsScreen(): React.JSX.Element {
  const headerRef = useTourTarget<View>('settings-header');
  const themeRef = useTourTarget<View>('theme-toggle');
  const notificationsRef = useTourTarget<View>('notifications');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View ref={headerRef} style={[styles.header, styles.settingsHeader]}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Configure your preferences</Text>
        </View>

        <View style={styles.main}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View ref={themeRef} style={styles.settingCard}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Dark Mode</Text>
              <Text style={styles.settingDescription}>Toggle between light and dark theme</Text>
            </View>
            <TouchableOpacity style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>Toggle</Text>
            </TouchableOpacity>
          </View>

          <View ref={notificationsRef} style={styles.settingCard}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Notifications</Text>
              <Text style={styles.settingDescription}>Manage notification preferences</Text>
            </View>
            <TouchableOpacity style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>Configure</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Language</Text>
              <Text style={styles.settingDescription}>Select your preferred language</Text>
            </View>
            <TouchableOpacity style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>English</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <TourProvider>
        <NavigationContainer>
          {/* eslint-disable-next-line react/style-prop-object */}
          <StatusBar style="light" />
          <TabBar />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'fade',
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </TourProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a202c',
  },
  scrollContent: {
    flexGrow: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a202c',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
    justifyContent: 'center',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#2d3748',
  },
  tabButtonText: {
    color: '#a0aec0',
    fontWeight: '500',
  },
  header: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
  settingsHeader: {
    backgroundColor: '#764ba2',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  main: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#f7fafc',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureCard: {
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f7fafc',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#667eea',
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
  installSection: {
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  installTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f7fafc',
    marginBottom: 12,
  },
  installCode: {
    backgroundColor: '#1a202c',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  installCodeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#68d391',
  },
  settingCard: {
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f7fafc',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#a0aec0',
  },
  toggleButton: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  toggleButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
});
