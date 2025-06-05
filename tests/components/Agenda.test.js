// tests/Agenda.test.js (or similar path)
import { Agenda } from '../../src/components/Agenda'; // Adjust path as needed

describe('Agenda', () => {
  let agenda;

  beforeEach(() => {
    agenda = new Agenda();
  });

  test('should initialize with no tasks', () => {
    expect(agenda.hasTasks).toBe(false);
    expect(agenda.shift()).toBeUndefined();
  });

  test('push should add a task to the end of the agenda', () => {
    const task1 = { type: 'assert', fact: { id: 1 } };
    const task2 = { type: 'retract', fact: { id: 2 } };

    agenda.push(task1);
    expect(agenda.hasTasks).toBe(true);
    // Internal state check (not usually recommended, but for a simple array it's okay for illustration)
    // expect(agenda['#tasks']).toEqual([task1]); // Accessing private field for test - be cautious

    agenda.push(task2);
    // expect(agenda['#tasks']).toEqual([task1, task2]);
  });

  test('shift should remove and return the next task from the beginning (FIFO)', () => {
    const task1 = { type: 'assert', fact: { id: 1 } };
    const task2 = { type: 'retract', fact: { id: 2 } };

    agenda.push(task1);
    agenda.push(task2);

    expect(agenda.hasTasks).toBe(true);
    expect(agenda.shift()).toBe(task1);
    expect(agenda.hasTasks).toBe(true);
    expect(agenda.shift()).toBe(task2);
    expect(agenda.hasTasks).toBe(false);
    expect(agenda.shift()).toBeUndefined();
  });

  test('hasTasks should correctly report if there are tasks', () => {
    expect(agenda.hasTasks).toBe(false);
    agenda.push({ type: 'test' });
    expect(agenda.hasTasks).toBe(true);
    agenda.shift();
    expect(agenda.hasTasks).toBe(false);
  });

  test('clear should remove all tasks from the agenda', () => {
    agenda.push({ type: 'task1' });
    agenda.push({ type: 'task2' });
    expect(agenda.hasTasks).toBe(true);

    agenda.clear();
    expect(agenda.hasTasks).toBe(false);
    expect(agenda.shift()).toBeUndefined();
    // expect(agenda['#tasks']).toEqual([]);
  });

  test('pushing various task types', () => {
    const task1 = { type: 'assert', data: { value: 'a' } };
    const task2 = { type: 'retract', id: 123 };
    const task3 = { customType: 'process', payload: {} };

    agenda.push(task1);
    agenda.push(task2);
    agenda.push(task3);

    expect(agenda.shift()).toBe(task1);
    expect(agenda.shift()).toBe(task2);
    expect(agenda.shift()).toBe(task3);
  });
});
