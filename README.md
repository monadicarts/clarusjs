# Clarus.js <img src="https://img.shields.io/github/license/monadicarts/clarusjs?style=flat-square" alt="MIT License" />

**A modern, expressive, and developer-friendly forward-chaining rule engine for JavaScript.**

Clarus.js lets you define complex business logic, data validation, and event-driven workflows in a highly readable, declarative, and JavaScript-native way. Inspired by classic expert systems (CLIPS, Clara Rules), Clarus.js is built for the modern JavaScript ecosystem.

---

## Table of Contents

- [Clarus.js ](#clarusjs-)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Accumulators API](#accumulators-api)
  - [Feature Showcase](#feature-showcase)

---

## Features

- **Modern JavaScript:** ES Modules, async/await, and a LEAPS-inspired architecture.
- **Fluent, Intuitive DSL:** Chainable API for rules and queries.
- **Expressive Pattern Matching:** Variable binding, wildcards, logical combinators, and accumulators.
- **Schema Validation:** Define fact schemas with type checking, required fields, defaults, and custom validators.
- **Truth Maintenance System (TMS):** Automatic retraction of logically asserted facts.
- **Event-Driven Orchestration:** Publish and subscribe to events for decoupled workflows.
- **Advanced Querying:** Fluent query builder, projections, ordering, and pagination.
- **Observability:** Event system for deep insight into engine operations.
- **Dynamic Rule Management:** Add or retract rules at runtime.
- **Salience & Control:** Prioritize rule execution and control engine flow.

---

## Installation

```sh
npm install clarusjs
```

---

## Quick Start

```javascript
import {
  LeapEngine, Rule, deftemplate, FactStorage, Agenda,
  AdvancedMatcher, SalienceConflictResolver, _
} from 'clarusjs';

// 1. Define fact schemas
const userTemplate = deftemplate('user', {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  status: { type: 'string', default: 'pending' },
  age: { type: 'number', validate: (v) => v >= 18 }
});

const orderTemplate = deftemplate('order', {
  id: { type: 'string', required: true },
  userId: { type: 'string', required: true },
  amount: { type: 'number', required: true },
  createdAt: { type: 'string', required: true }
});

// 2. Create an engine instance
const engine = new LeapEngine({
  factStorage: new FactStorage(),
  agenda: new Agenda(),
  matcher: new AdvancedMatcher(),
  resolver: new SalienceConflictResolver(),
});

// 3. Define and add a rule: Welcome new users over 21
const welcomeRule = Rule('WelcomeNewUser')
  .when({ user: { id: '?userId', name: '?name', status: 'pending', age: '?age' } })
  .pre(_.guard.gt('?age', 21))
  .then((ctx, b) => {
    ctx.assertFact({
      type: 'notification',
      userId: b['?userId'],
      message: `Welcome aboard, ${b['?name']}!`
    });
    ctx.modifyFact(b.user._id, { status: 'active' });
  })
  .build();

engine.addDefinition(welcomeRule);

// 4. Assert facts and run the engine
engine.assertFact(userTemplate.create({ id: 'usr_001', name: 'Alice', age: 30 }));
engine.assertFact(userTemplate.create({ id: 'usr_002', name: 'Bob', age: 19 }));

await engine.fireAll();
```

---

## Accumulators API

Clarus.js provides **type-specific accumulator functions** for use in rules, queries, and projections.  
You use them declaratively with the `_.from()` and fluent accumulator helpers:

```js
_.from({ type: 'order', customerId: '?cid', status: 'pending' })
  .sum('amount')
  .into('?totalPendingAmount')
```

Supported accumulators:
- `.sum(field)`
- `.average(field)`
- `.minNumber(field)`
- `.maxNumber(field)`
- `.minDate(field)`
- `.maxDate(field)`
- `.minString(field)`
- `.maxString(field)`
- `.minBoolean(field)`
- `.maxBoolean(field)`
- `.collect(field)`
- `.distinctCollect(field)`
- `.count()`

---

## Feature Showcase

```javascript
import {
  LeapEngine, Rule, Query, deftemplate, _, accumulators,
  FactStorage, Agenda, AdvancedMatcher, SalienceConflictResolver
} from 'clarusjs';

// --- 1. Fact Schemas with Validation & Defaults ---
const User = deftemplate('user', {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  status: { type: 'string', default: 'pending' },
  age: { type: 'number', validate: v => v >= 18 }
});
const Order = deftemplate('order', {
  id: { type: 'string', required: true },
  userId: { type: 'string', required: true },
  amount: { type: 'number', required: true },
  createdAt: { type: 'string', required: true }
});

// --- 2. Engine Setup ---
const engine = new LeapEngine({
  factStorage: new FactStorage(),
  agenda: new Agenda(),
  matcher: new AdvancedMatcher(),
  resolver: new SalienceConflictResolver(),
});

// --- 3. Helper: Notification ---
function notify(userId, message) {
  engine.assertFact({ type: 'notification', userId, message });
}

// --- 4. Rule: Welcome New Users (Pattern Matching, Guards, Fact Modification) ---
engine.addDefinition(
  Rule('WelcomeNewUser')
    .when({ user: { id: '?uid', name: '?name', status: 'pending', age: '?age' } })
    .pre(_.guard.gte('?age', 21))
    .then((ctx, b) => {
      notify(b['?uid'], `Welcome, ${b['?name']}!`);
      ctx.modifyFact(b.user._id, { status: 'active' });
    })
    .build()
);

// --- 5. Rule: High Value Customer (Accumulators, Logical Assertion) ---
engine.addDefinition(
  Rule('HighValueCustomer')
    .when(
      { user: { id: '?uid', status: 'active' } },
      _.from({ type: 'order', userId: '?uid' }).sum('amount').into('?total')
    )
    .pre(_.guard.gt('?total', 1000))
    .then((ctx, b) => {
      ctx.assertFact({ type: 'vip', userId: b['?uid'] }, { logical: true });
      notify(b['?uid'], 'You are now a VIP!');
    })
    .build()
);

// --- 6. Rule: Distinct Interests (Accumulators, Projection) ---
engine.addDefinition(
  Rule('CollectUserInterests')
    .when(
      { user: { id: '?uid' } },
      _.from({ type: 'activity', userId: '?uid' }).distinctCollect('category').into('?interests')
    )
    .pre(_.guard.hasSize('?interests', _.gt(0)))
    .then((ctx, b) => {
      ctx.assertFact({ type: 'user_profile', userId: b['?uid'], interests: b['?interests'] });
    })
    .build()
);

// --- 7. Query: Find VIPs (Projection, Ordering) ---
engine.addDefinition(
  Query('FindVIPs')
    .when({ vip: { userId: '?uid' } }, { user: { id: '?uid', name: '?name' } })
    .select({ id: '?uid', name: '?name' })
    .orderBy('name')
    .build()
);

// --- 8. Observability: Event Hook ---
engine.on('assert', fact => {
  if (fact.type === 'notification') {
    console.log('Notify:', fact.message);
  }
});

// --- 9. Usage Example ---
engine.assertFact(User.create({ id: 'u1', name: 'Alice', age: 30 }));
engine.assertFact(User.create({ id: 'u2', name: 'Bob', age: 19 }));
engine.assertFact(Order.create({ id: 'o1', userId: 'u1', amount: 1200, createdAt: '2024-01-01' }));
engine.assertFact({ type: 'activity', userId: 'u1', category: 'sports' });
engine.assertFact({ type: 'activity', userId: 'u1', category: 'tech' });

await engine.fireAll();

const vips = await engine.queryAll('FindVIPs');
console.log('VIPs:', vips);
```

**This single example demonstrates:**
- Schema validation, defaults, and custom validators
- Fluent, chainable rule and query DSL
- Pattern matching, variable binding, and guards
- Accumulators for sum and distinct collection
- Logical assertion and truth maintenance
- Fact modification and notification (event-driven)
- Query projection and ordering
- Observability via event hooks

See [API documentation](#accumulators-api) for more details.
