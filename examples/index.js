/**
 * examples/index.js
 *
 * This file showcases the various features of the Clarus.js rule engine.
 * It's designed to be a comprehensive demonstration based on the features
 * outlined in the project's README.md.
 */

import {
  LeapEngine,
  Rule,
  Query,
  deftemplate,
  _, // Utility for guards and accumulators
  FactStorage,
  Agenda,
  AdvancedMatcher,
  SalienceConflictResolver,
  accumulators
} from '../src/index.js'; // Using direct source for development

async function runShowcase() {
  console.log("🚀 Starting Clarus.js Feature Showcase 🚀\n");

  // --- 1. Schema Validation & Defaults (deftemplate) ---
  console.log("--- 1. Fact Schemas (deftemplate) ---");
  const UserSchema = deftemplate('user', {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    status: { type: 'string', default: 'pending_validation' },
    age: { type: 'number', validate: v => v >= 18, message: "User must be 18 or older." },
    email: { type: 'string', required: false, format: 'email' }, // Assuming a 'format' validator
    tags: { type: 'array', default: [] }
  });

  const OrderSchema = deftemplate('order', {
    id: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    item: { type: 'string', required: true },
    amount: { type: 'number', required: true, validate: v => v > 0 },
    status: { type: 'string', default: 'placed' } // e.g., placed, shipped, delivered, cancelled
  });

  const ActivitySchema = deftemplate('activity', {
    userId: { type: 'string', required: true },
    type: { type: 'string', required: true }, // e.g., 'login', 'view_product', 'add_to_cart'
    category: { type: 'string' } // For interest collection
  });

  console.log("UserSchema defined:", UserSchema.name);
  console.log("OrderSchema defined:", OrderSchema.name);
  console.log("ActivitySchema defined:", ActivitySchema.name);
  console.log("\n");

  // --- 2. Engine Setup ---
  // Using components mentioned in README for a typical setup
  const engine = new LeapEngine({
    factStorage: new FactStorage(),
    agenda: new Agenda(),
    matcher: new AdvancedMatcher(),
    resolver: new SalienceConflictResolver(),
    accumulators,
  });

  // --- Helper for Notifications (demonstrates event-driven nature) ---
  function notify(userId, message, type = 'info') {
    engine.assertFact({ type: 'notification', userId, message, notificationType: type, timestamp: new Date().toISOString() });
  }

  // --- 3. Observability: Event Hooks ---
  console.log("--- 3. Observability (Event Hooks) ---");
  engine.on('assert', (fact) => {
    if (fact.type === 'notification') {
      console.log(`[Notification] To ${fact.userId}: ${fact.message} (Type: ${fact.notificationType})`); 
    } else if (fact.type !== 'log_ignore') { // Avoid logging internal/utility facts if any
      console.log(`[Event: ASSERT] Fact asserted: ${fact.type} (${fact._id || JSON.stringify(fact)})`);
    }
  });
  engine.on('retract', (fact) => {
    console.log(`[Event: RETRACT] Fact retracted: ${fact.type} (${fact._id || JSON.stringify(fact)})`);
  });
  engine.on('modify', (factId, updates, oldFact) => {
    console.log(`[Event: MODIFY] Fact modified: ID ${factId}, New state: ${oldFact.type}`);
  });
  engine.on('fire', (ruleName, bindings) => {
    console.log(`[Event: FIRE] Rule fired: ${ruleName}`);
  });

  // Add these debug listeners before asserting facts
  engine.on('rule:actionSuccess', ({ ruleId, bindings }) => {
    if (ruleId === 'HighValueCustomer') {
      console.log('[DEBUG] HighValueCustomer fired:', {
        userId: bindings['?uid'],
        totalSpent: bindings['?totalSpent']
      });
    }
  });

  engine.on('rule:beforeAction', ({ ruleId, bindings }) => {
    if (ruleId === 'HighValueCustomer') {
      console.log('[DEBUG] VIP Rule pre-execution:', {
        userId: bindings['?uid'],
        totalSpent: bindings['?totalSpent'],
        user: bindings.user
      });
    }
  });

  engine.on('engine:queryCompleted', ({ queryId, results }) => {
    if (queryId === 'FindActiveUsers') {
      console.log('[DEBUG] Active Users Query Results:', results);
    }
  });

  console.log("Event listeners for assert, retract, modify, fire are set up.\n");

  // --- 4. Fluent DSL & Expressive Pattern Matching (Rules, Guards) ---
  console.log("--- 4. Fluent DSL & Pattern Matching ---");

  // Rule: Welcome new adult users and activate them
  const welcomeUserRule = Rule('WelcomeNewUserAndActivate')
    .when({ user: { type: UserSchema.name, id: '?uid', name: '?name', status: 'pending_validation', age: '?age' } })
    .pre(_.guard.gte('?age', 18)) // Guard: age must be >= 18 (though schema also validates)
    .then((ctx, b) => {
      notify(b['?uid'], `Welcome, ${b['?name']}! Your account is being activated.`);
      ctx.modifyFact(b.user._id, { status: 'active' });
    })
    .build();
  engine.addDefinition(welcomeUserRule);

  // Rule: Flag underage users based on schema validation failure (hypothetical, schema handles this on create)
  // This rule demonstrates reacting to a state that *could* exist if schema validation was bypassed or different
  const flagUnderageRule = Rule('FlagUnderageUserAttempt')
    .when({ user: { type: UserSchema.name, id: '?uid', status: 'pending_validation', age: '?age' } })
    .pre(_.guard.lt('?age', 18))
    .then((ctx, b) => {
      notify(b['?uid'], `User ${b['?uid']} is underage (${b['?age']}). Account cannot be activated.`, 'error');
      ctx.modifyFact(b.user._id, { status: 'rejected_underage' });
    })
    .build();
  engine.addDefinition(flagUnderageRule);

  console.log("Rules 'WelcomeNewUserAndActivate' and 'FlagUnderageUserAttempt' added.\n");

  // --- 5. Accumulators ---
  console.log("--- 5. Accumulators ---");
  const highValueCustomerRule = Rule('HighValueCustomer')
    .when(
      { user: { type: UserSchema.name, id: '?uid', status: 'active' } },
      _.from({ type: OrderSchema.name, userId: '?uid', status: 'delivered' })
        .sum('amount')
        .into('?totalSpent')
    )
    .pre(_.guard.gt('?totalSpent', 1000))
    .then((ctx, b) => {
      console.log('[DEBUG] VIP Rule executing for:', {
        userId: b['?uid'],
        totalSpent: b['?totalSpent'],
        user: b.user,
        status: b.user.status // Add status to debug output
      });
      ctx.assertFact(
        { 
          type: 'vip_status', 
          userId: b['?uid'], 
          level: 'gold', 
          reason: `High Spender ($${b['?totalSpent']})` 
        }, 
        { logical: true }
      );
      notify(b['?uid'], `Congratulations ${b.user.name}! You're now a Gold VIP due to spending over $${b['?totalSpent']}.`);
    })
    .build();
  engine.addDefinition(highValueCustomerRule);

  const collectInterestsRule = Rule('CollectUserInterests')
    .when(
      { user: { type: UserSchema.name, id: '?uid' } },
      _.from({ type: ActivitySchema.name, userId: '?uid', category: '?cat' })
        .distinctCollect('?cat')
        .into('?interests')
    )
    .pre(_.guard.hasSize('?interests', _.gt(0)))
    .then((ctx, b) => {
      console.log('[DEBUG] CollectUserInterests executing:', {
        userId: b['?uid'],
        interests: b['?interests']
      });
      ctx.assertFact({ 
        type: 'user_profile', 
        userId: b['?uid'], 
        interests: b['?interests'] 
      });
    })
    .build();
  engine.addDefinition(collectInterestsRule);
  console.log("Rules 'HighValueCustomer' (with TMS) and 'CollectUserInterests' (with accumulators) added.\n");

  // --- 7. Salience & Control ---
  console.log("--- 7. Salience & Control ---");
  const urgentNotificationRule = Rule('UrgentNotification')
    .salience(100) // Higher salience, fires before lower salience rules
    .when({ notification: { type: 'notification', userId: '?uid', notificationType: 'error' } })
    .then((ctx, b) => {
      console.log(`[URGENT ACTION] Processing error notification for ${b['?uid']}: ${b.notification.message}`);
      // Potentially assert a new fact to trigger an escalation workflow
      ctx.assertFact({ type: 'escalation_needed', userId: b['?uid'], originalMessage: b.notification.message });
    })
    .build();
  engine.addDefinition(urgentNotificationRule);

  const standardNotificationRule = Rule('StandardNotificationProcessing')
    .salience(10) // Lower salience
    .when({ notification: { type: 'notification', userId: '?uid', notificationType: 'info' } })
    .then((ctx, b) => {
      console.log(`[STANDARD LOG] Logged info notification for ${b['?uid']}: ${b.notification.message}`);
    })
    .build();
  engine.addDefinition(standardNotificationRule);
  console.log("Salience rules 'UrgentNotification' (100) and 'StandardNotificationProcessing' (10) added.\n");

  // --- Asserting Facts & Running Engine (Initial Run) ---
  console.log("--- Initial Fact Assertion & Engine Run ---");
  try {
    // 1. Assert users and activate them
    engine.assertFact(UserSchema.create({ id: 'user1', name: 'Alice', age: 30, email: 'alice@example.com' }));
    engine.assertFact(UserSchema.create({ id: 'user2', name: 'Bob', age: 17 }));
    engine.assertFact(UserSchema.create({ id: 'user3', name: 'Charlie', age: 25, status: 'active', email: 'charlie@example.com' }));
    engine.assertFact(UserSchema.create({ id: 'user4', name: 'Diana', age: 40 }));
    engine.assertFact(UserSchema.create({ id: 'user5', name: 'Eddie', age: 45, status: 'active', email: 'eddie@example.com' }));

    await engine.fireAll(); // Activate users

    // 2. Assert activities before orders
    engine.assertFact(ActivitySchema.create({ userId: 'user1', type: 'view_page', category: 'tech' }));
    engine.assertFact(ActivitySchema.create({ userId: 'user1', type: 'view_page', category: 'books' }));
    engine.assertFact(ActivitySchema.create({ userId: 'user1', type: 'purchase', category: 'tech' }));

    // 3. Then assert orders
    engine.assertFact(OrderSchema.create({ id: 'order1', userId: 'user1', item: 'Book', amount: 50 }));
    engine.assertFact(OrderSchema.create({ id: 'order2', userId: 'user1', item: 'Laptop', amount: 1200, status: 'delivered' }));
    engine.assertFact(OrderSchema.create({ id: 'order3', userId: 'user3', item: 'Keyboard', amount: 75, status: 'delivered' }));
    engine.assertFact(OrderSchema.create({ id: 'order4', userId: 'user3', item: 'Monitor', amount: 300, status: 'delivered' }));
    engine.assertFact(OrderSchema.create({ id: 'order7', userId: 'user5', item: 'TV', amount: 1700, status: 'delivered' }));
    engine.assertFact(OrderSchema.create({ id: 'order8', userId: 'user5', item: 'Phone', amount: 1400, status: 'delivered' }));

    await engine.fireAll(); // Process both profiles and VIP status
    console.log('[DEBUG] VIP Status Facts after Eddie orders:', JSON.stringify(engine.getFacts({ type: 'vip_status' }), null, 2));

    await engine.fireAll(); // Second fire: Process VIP status based on orders

    console.log("--- Initial engine run complete. --- \n");
  } catch (error) {
    console.error("[SCHEMA ERROR] During fact creation:", error.message);
  }
  // --- 8. Truth Maintenance System (TMS) Demonstration ---
  console.log("--- 8. TMS Demonstration (VIP Status Change) ---");
  // Alice (user1) should be a VIP because order2 ($1200) > $1000.
  // Let's "cancel" Alice's high-value order and see if VIP status is retracted.
  const order2Fact = engine.getFacts({ type: OrderSchema.name, id: 'order2' })[0];
  if (order2Fact) {
    console.log(`Modifying Alice's order ${order2Fact.id} to have amount 50 (was ${order2Fact.amount}).`);
    engine.modifyFact(order2Fact._id, { amount: 50, status: 'cancelled' }); // Amount now below VIP threshold
    // or engine.retractFact(order2Fact._id);
  }

  await engine.fireAll();
  console.log("--- Engine run after order modification (TMS check). ---");
  const aliceVipStatus = engine.getFacts({ type: 'vip_status', userId: 'user1' });
  if (aliceVipStatus.length === 0) {
    console.log("TMS Check: Alice's VIP status was correctly retracted as her total spending dropped.");
  } else {
    console.log("TMS Check: Alice is still a VIP. (This might indicate an issue or different logic).", aliceVipStatus);
  }
  console.log("\n");

  // --- 9. Advanced Querying (Projection, Ordering, Pagination) ---
  console.log("--- 9. Advanced Querying ---");
  const findActiveUsersQuery = Query('FindActiveUsers')
    .when({ 
      user: { 
        type: UserSchema.name, 
        status: 'active', 
        name: '?name', 
        email: '?email',
        id: '?id',    // Bind directly
        age: '?age'   // Bind directly
      } 
    })
    .select({
      id: '?id',
      fullName: '?name',
      contact: '?email',
      originalAge: '?age'
    })
    .orderBy('fullName', 'asc')
    .build();
  engine.addDefinition(findActiveUsersQuery);

  const activeUsers = await engine.queryAll('FindActiveUsers');
  console.log("Active Users (sorted by name):", JSON.stringify(activeUsers, null, 2));

  // Query with Pagination
  const allOrdersQuery = Query('GetAllOrdersPaginated')
    .when({ order: { type: OrderSchema.name, amount: '?amount' } }) // Simplified pattern
    .select(['?order'])
    .orderBy('?amount', 'desc')
    .build();
  engine.addDefinition(allOrdersQuery);

  const firstPageOrders = await engine.queryAll('GetAllOrdersPaginated');
  console.log("All Orders (Page 1, Limit 2, Ordered by Amount DESC):", JSON.stringify(firstPageOrders, null, 2));

  // To get the next page, you would change offset:
  // const secondPageOrders = await engine.queryAll('GetAllOrdersPaginated', null, { offset: 2 });
  // console.log("All Orders (Page 2, Limit 2):", secondPageOrders);
  console.log("\n");

  // --- 10. Dynamic Rule Management ---
  console.log("--- 10. Dynamic Rule Management ---");
  const temporarySaleRule = Rule('TemporarySaleDiscount')
    .when({ order: { type: OrderSchema.name, userId: '?uid', amount: '?amt' } })
    .pre(_.guard.gt('?amt', 50))
    .then((ctx, b) => {
      notify(b['?uid'], `Special 10% discount applied to order ${b.order.id}!`, 'promo');
      ctx.modifyFact(b.order._id, { amount: b['?amt'] * 0.9 });
    })
    .build();

  console.log("Adding 'TemporarySaleDiscount' rule.");
  engine.addDefinition(temporarySaleRule);
  engine.assertFact(OrderSchema.create({ id: 'order5', userId: 'user4', item: 'Gadget', amount: 100 }));
  await engine.fireAll(); // Sale rule should fire

  console.log("Retracting 'TemporarySaleDiscount' rule.");
  engine.retractDefinition('TemporarySaleDiscount');
  engine.assertFact(OrderSchema.create({ id: 'order6', userId: 'user4', item: 'Another Gadget', amount: 100 }));
  await engine.fireAll(); // Sale rule should NOT fire
  console.log("--- Dynamic rule management demonstration complete. ---\n");

  // --- Final State Check ---
  console.log("--- Final State Check ---");
  console.log("All User Facts:", JSON.stringify(engine.getFacts({ type: UserSchema.name }), null, 2));
  console.log("All Order Facts:", JSON.stringify(engine.getFacts({ type: OrderSchema.name }), null, 2));
  console.log("All VIP Status Facts:", JSON.stringify(engine.getFacts({ type: 'vip_status' }), null, 2));
  console.log("All User Profile Facts:", JSON.stringify(engine.getFacts({ type: 'user_profile' }), null, 2));

  console.log("\n✅ Clarus.js Feature Showcase Complete ✅");
}

runShowcase().catch(error => {
  console.error("💥 An error occurred during the showcase:", error);
});

/**
 * To run this example:
 * 1. Make sure `clarusjs` is built and accessible.
 *    If running from the clarusjs project root, you might import from a relative path
 *    to your dist folder, e.g., `from '../dist/clarus.esm.js'`.
 * 2. If `clarusjs` is installed as a dependency: `import ... from 'clarusjs';`
 * 3. Execute this file with Node.js: `node examples/index.js`
 *    (Ensure your package.json has "type": "module" or use .mjs extension if using ES modules directly with node)
 */

/*
Assumed features from README.md and their demonstration:

- Modern JavaScript: ES Modules (import/export), async/await (runShowcase, fireAll, queryAll).
- Fluent, Intuitive DSL:
    - Rule(...).when(...).pre(...).then(...).salience(...).build()
    - Query(...).when(...).select(...).orderBy(...).limit(...).offset(...).build()
- Expressive Pattern Matching:
    - Variable binding: `id: '?uid'`
    - Guards: `_.guard.gte('?age', 18)`
    - Accumulators: `_.from(...).sum(...).into(...)`, `_.from(...).distinctCollect(...).into(...)`
    - (Wildcards: `_` utility is shown for guards/accumulators. Direct wildcard in pattern e.g. `{ type: _ }` is assumed if AdvancedMatcher supports it)
- Schema Validation:
    - `deftemplate` with `type`, `required`, `default`, `validate` function, `message`.
    - `UserSchema.create(...)` implicitly uses these. Error handling for schema violations shown via try/catch or rule.
- Truth Maintenance System (TMS):
    - `ctx.assertFact(..., { logical: true })` in 'HighValueCustomerRule'.
    - Demonstration of auto-retraction when conditions for logical fact no longer hold (VIP status).
- Event-Driven Orchestration:
    - Rules asserting 'notification' facts.
    - Other rules reacting to 'notification' facts (UrgentNotification, StandardNotificationProcessing).
    - `notify` helper function.
- Advanced Querying:
    - `Query` definition with `when`, `select` (projection), `orderBy`.
    - Pagination with `limit()` and `offset()`.
- Observability:
    - `engine.on('assert', ...)`
    - `engine.on('retract', ...)`
    - `engine.on('modify', ...)`
    - `engine.on('fire', ...)`
- Dynamic Rule Management:
    - `engine.addDefinition(rule)`
    - `engine.retractDefinition('RuleName')`
    - Demonstrated with 'TemporarySaleDiscount' rule.
- Salience & Control:
    - `Rule(...).salience(value)` to prioritize rule execution.
    - Demonstrated with 'UrgentNotificationRule' and 'StandardNotificationProcessing'.
*/