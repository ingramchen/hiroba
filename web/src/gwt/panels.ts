import { Comment, Fragment, defineComponent, h, type PropType, type VNode } from 'vue';

export type Align = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';

export interface CellSpec {
  align?: Align;
  valign?: VAlign;
  width?: string;
  height?: string;
  cls?: string;
  colspan?: number;
  empty?: boolean;
  blank?: boolean;
  textAlign?: Align;
}

function children(slot: (() => VNode[]) | undefined): VNode[] {
  const raw = slot ? slot() : [];
  const out: VNode[] = [];
  for (const node of raw) {
    if (node.type === Fragment && Array.isArray(node.children)) {
      out.push(...children(() => node.children as VNode[]));
    } else {
      out.push(node);
    }
  }
  return out.filter((n) => n.type !== Comment);
}

function cell(node: VNode, spec: CellSpec, defAlign: Align, defValign: VAlign): VNode {
  return h(
    'td',
    {
      class: spec.cls,
      align: spec.align ?? defAlign,
      width: spec.width,
      height: spec.height,
      colspan: spec.colspan,
      style: { 'vertical-align': spec.valign ?? defValign },
    },
    [node],
  );
}

const cellPanelProps = {
  spacing: { type: Number, default: 0 },
  padding: { type: Number, default: 0 },
  valign: { type: String as PropType<VAlign>, default: 'top' },
  align: { type: String as PropType<Align>, default: 'left' },
  cells: { type: Array as PropType<CellSpec[]>, default: () => [] },
  tableStyle: { type: Object as PropType<Record<string, string>>, default: undefined },
};

export const VerticalPanel = defineComponent({
  name: 'VerticalPanel',
  props: cellPanelProps,
  setup(props, { slots }) {
    return () =>
      h(
        'table',
        {
          cellspacing: String(props.spacing),
          cellpadding: String(props.padding),
          style: props.tableStyle,
        },
        [
          h(
            'tbody',
            children(slots.default).map((node, i) =>
              h('tr', [cell(node, props.cells[i] ?? {}, props.align, props.valign)]),
            ),
          ),
        ],
      );
  },
});

export const HorizontalPanel = defineComponent({
  name: 'HorizontalPanel',
  props: cellPanelProps,
  setup(props, { slots }) {
    return () =>
      h(
        'table',
        {
          cellspacing: String(props.spacing),
          cellpadding: String(props.padding),
          style: props.tableStyle,
        },
        [
          h('tbody', [
            h(
              'tr',
              children(slots.default).map((node, i) =>
                cell(node, props.cells[i] ?? {}, props.align, props.valign),
              ),
            ),
          ]),
        ],
      );
  },
});

export const GwtTable = defineComponent({
  name: 'GwtTable',
  props: {
    columns: { type: Number, default: 1 },
    spacing: { type: Number, default: undefined },
    padding: { type: Number, default: undefined },
    rows: { type: Array as PropType<CellSpec[][]>, default: () => [] },
    tableStyle: { type: Object as PropType<Record<string, string>>, default: undefined },
  },
  setup(props, { slots }) {
    return () => {
      const flat = children(slots.default);
      const specs = props.rows.length ? props.rows : [flat.map(() => ({}) as CellSpec)];
      let index = 0;
      const body: VNode[] = [];
      for (const row of specs) {
        const tds = row.map((spec) => {
          const node = spec.empty || spec.blank ? undefined : flat[index++];
          return h(
            'td',
            {
              ...(node === undefined && spec.empty ? { innerHTML: '&nbsp;' } : {}),
              class: spec.cls,
              align: spec.align,
              width: spec.width,
              height: spec.height,
              colspan: spec.colspan,
              style:
                spec.valign || spec.textAlign
                  ? {
                      ...(spec.textAlign ? { 'text-align': spec.textAlign } : {}),
                      ...(spec.valign ? { 'vertical-align': spec.valign } : {}),
                    }
                  : undefined,
            },
            node ? [node] : undefined,
          );
        });
        body.push(h('tr', tds));
      }
      return h(
        'table',
        {
          cellspacing: props.spacing === undefined ? undefined : String(props.spacing),
          cellpadding: props.padding === undefined ? undefined : String(props.padding),
          style: props.tableStyle,
        },
        [
          h(
            'colgroup',
            Array.from({ length: props.columns }, () => h('col')),
          ),
          h('tbody', body),
        ],
      );
    };
  },
});
