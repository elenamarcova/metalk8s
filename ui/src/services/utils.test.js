import {
  sortCapacity,
  addMissingDataPoint,
  jointDataPointBaseonTimeSeries,
} from './utils';

const testcases = [
  { storageCapacity: '1Ki' },
  { storageCapacity: '1Gi' },
  { storageCapacity: '100Mi' },
  { storageCapacity: '10Gi' },
  { storageCapacity: '1Mi' },
];

const testcases2 = [
  { storageCapacity: '42949670k' },
  { storageCapacity: '100Mi' },
  { storageCapacity: '250Gi' },
  { storageCapacity: '1Gi' },
  { storageCapacity: '1Mi' },
  { storageCapacity: '11111111111' },
  { storageCapacity: '10Gi' },
];

it('should sort correctly the array', () => {
  const result = sortCapacity(testcases);
  expect(result).toEqual([
    { storageCapacity: '1Ki' },
    { storageCapacity: '1Mi' },
    { storageCapacity: '100Mi' },
    { storageCapacity: '1Gi' },
    { storageCapacity: '10Gi' },
  ]);

  const result2 = sortCapacity(testcases2, 'storageCapacity');
  expect(result2).toEqual([
    { storageCapacity: '1Mi' },
    { storageCapacity: '100Mi' },
    { storageCapacity: '1Gi' },
    { storageCapacity: '10Gi' },
    { storageCapacity: '11111111111' },
    { storageCapacity: '42949670k' },
    { storageCapacity: '250Gi' },
  ]);
});

it('should return an empty array if no arguments', () => {
  const result = sortCapacity();
  expect(result).toEqual([]);
});

it('should not break when the user put the wrong sortBy', () => {
  const result = sortCapacity(testcases, 'toto');
  expect(result).toEqual([
    { storageCapacity: '1Ki' },
    { storageCapacity: '1Gi' },
    { storageCapacity: '100Mi' },
    { storageCapacity: '10Gi' },
    { storageCapacity: '1Mi' },
  ]);
});

it('should keep the original sequence when the user put the wrong sortDirection', () => {
  const result = sortCapacity(testcases, 'storageCapacity', 'toto');
  expect(result).toEqual([
    { storageCapacity: '1Ki' },
    { storageCapacity: '1Gi' },
    { storageCapacity: '100Mi' },
    { storageCapacity: '10Gi' },
    { storageCapacity: '1Mi' },
  ]);
});

it('should not break when a item is null', () => {
  const testcases = [
    { storageCapacity: '1Ki' },
    { storageCapacity: '1Gi' },
    { storageCapacity: '100Mi' },
    null,
    { storageCapacity: '1Mi' },
  ];

  const result = sortCapacity(testcases);
  expect(result).toEqual([
    { storageCapacity: '1Ki' },
    { storageCapacity: '1Mi' },
    { storageCapacity: '100Mi' },
    { storageCapacity: '1Gi' },
    null,
  ]);
});

it('test the sort with a custom sortBy', () => {
  const testcases = [
    { yanjin: '1Ki' },
    { yanjin: '1Gi' },
    { yanjin: '100Mi' },
    { yanjin: '1Mi' },
  ];

  const result = sortCapacity(testcases, 'yanjin');
  expect(result).toEqual([
    { yanjin: '1Ki' },
    { yanjin: '1Mi' },
    { yanjin: '100Mi' },
    { yanjin: '1Gi' },
  ]);
});

// test for addMissingDataPoint function
const originalValue = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [8, 8],
  [9, 9],
  [10, 10],
];
const startingTimeStamp = 0;
const sampleDuration = 11;
const sampleFrequency = 1;
const newValues = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [7, null],
  [8, 8],
  [9, 9],
  [10, 10],
];
it('should add missing data point with null', () => {
  const result = addMissingDataPoint(
    originalValue,
    startingTimeStamp,
    sampleDuration,
    sampleFrequency,
  );
  expect(result).toEqual(newValues);
});

it('should return an empty array when the original dataset is empty', () => {
  const result = addMissingDataPoint(
    [],
    startingTimeStamp,
    sampleDuration,
    sampleFrequency,
  );
  expect(result).toEqual([]);
});

it('should return an empty array when the starting timestamp is undefined', () => {
  const result = addMissingDataPoint(
    originalValue,
    undefined,
    sampleDuration,
    sampleFrequency,
  );
  expect(result).toEqual([]);
});

it('should return an empty array when sample duration is less than or equal to zero', () => {
  const result = addMissingDataPoint(
    originalValue,
    startingTimeStamp,
    0,
    sampleFrequency,
  );
  expect(result).toEqual([]);
});

it('should return an empty array when sample frequency is less than or equal to zero', () => {
  const result = addMissingDataPoint(
    originalValue,
    startingTimeStamp,
    sampleDuration,
    -1,
  );
  expect(result).toEqual([]);
});

it('should return an empty array when sample frequency is undefined', () => {
  const result = addMissingDataPoint(
    originalValue,
    startingTimeStamp,
    sampleDuration,
    undefined,
  );
  expect(result).toEqual([]);
});

const originalValueWithAllZero = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [5, 0],
  [6, 0],
  [7, 0],
  [8, 0],
  [9, 0],
  [10, 0],
];
it('should return all zero when the original dataset is all zero', () => {
  const result = addMissingDataPoint(
    originalValueWithAllZero,
    startingTimeStamp,
    sampleDuration,
    sampleFrequency,
  );
  expect(result).toEqual(originalValueWithAllZero);
});
