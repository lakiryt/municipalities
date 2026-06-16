export type BaseItemValue<T extends string | number, Item> = {
  label: string
  valueGetter: (item: Item) => T
}

export type Expression<Item> = BaseItemValue<string, Item> | Formula<Item>

export type Formula<Item> = Negation<Item> | Sum<Item> | BaseItemValue<number, Item>

type Sum<Item> = {
  addends: Formula<Item>[]
}

type Negation<Item> = {
  negatedvalue: Formula<Item>
}

const calculateSum = <Item,>(s: Sum<Item>) => (item: Item): number =>
  s.addends.reduce((acc, key) => acc + calculate(key)(item), 0)

const calculateNegation = <Item,>(s: Negation<Item>) => (item: Item): number =>
  -calculate(s.negatedvalue)(item)

export const calculate = <Item,>(formula: Formula<Item>) => (item: Item): number => {
  if ("addends" in formula) {
    return calculateSum(formula)(item)
  } else if ("negatedvalue" in formula) {
    return calculateNegation(formula)(item)
  } else {
    return formula.valueGetter(item)
  }
}
