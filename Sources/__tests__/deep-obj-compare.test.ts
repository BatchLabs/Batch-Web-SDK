/* eslint-env jest */

import deepObjectCompare from "com.batch.shared/helpers/deep-obj-compare";

const a = {
  rando: "coucou",
  bojo: 465465,
  item: {
    p1: {},
    bol: true,
    fal: false,
  },
};

const b = {
  rando: "coucou",
  bojo: 465465,
  item: {
    p1: {},
    bol: true,
    fal: false,
  },
};

const c = {
  rando: "couCou",
  bojo: 465465,
  item: {
    p1: {},
    bol: true,
    fal: false,
  },
};

const d = {
  rando: "coucou",
  bojo: [465465],
  item: {
    p1: {},
    bol: true,
    fal: false,
  },
};

test("same shit", () => {
  expect(deepObjectCompare(a, b)).toBe(true);
});

test("not same shit", () => {
  expect(deepObjectCompare(a, c)).toBe(false);
  expect(deepObjectCompare(a, d)).toBe(false);
});

test("with first object empty", () => {
  expect(deepObjectCompare({}, b)).toBe(false);
});

test("with second object empty", () => {
  expect(deepObjectCompare(a, {})).toBe(false);
});
