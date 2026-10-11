import type {ReactNode} from 'react';
import type {TourTooltipProps} from '../types/tour-tooltip-props.type.js';
import {useRendererContext} from './renderer-context.js';
import {tooltipModel} from './tooltip-model.js';

/** The built-in tooltip: the same structure and texts on every platform, drawn with the platform's card parts. */
export function DefaultTooltip(props: TourTooltipProps): ReactNode {
  const {renderer, i18n} = useRendererContext();
  const {Card, Arrow, Header, Counter, CloseButton, Body, Title, Content, Footer, Button, Dots, Dot, Ellipsis} =
    renderer.card;
  const model = tooltipModel(props, i18n);
  return (
    <Card placement={props.placement}>
      {model.arrow ? <Arrow side={model.arrow.side} offset={model.arrow.offset} /> : null}
      <Header>
        <Counter text={model.counter} />
        <CloseButton label={model.closeLabel} onPress={props.onClose} />
      </Header>
      <Body>
        <Title id={props.titleId}>{props.step.title}</Title>
        <Content id={props.descriptionId}>{props.step.content}</Content>
      </Body>
      <Footer>
        <Button
          kind="previous"
          label={model.previous.label}
          isDisabled={model.previous.isDisabled}
          onPress={props.onPrev}
        />
        {model.dots ? (
          <Dots label={model.counter}>
            {model.dots.map((dot) =>
              dot.kind === 'ellipsis' ? (
                <Ellipsis key={dot.key} />
              ) : (
                <Dot
                  key={dot.index}
                  label={dot.label}
                  isCurrent={dot.isCurrent}
                  onPress={() => {
                    props.onGoToStep(dot.index);
                  }}
                />
              ),
            )}
          </Dots>
        ) : null}
        <Button kind="next" label={model.next.label} isDisabled={false} onPress={props.onNext} />
      </Footer>
    </Card>
  );
}
