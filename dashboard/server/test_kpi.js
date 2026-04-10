async function test() {
  const API_BASE = 'http://127.0.0.1:5000';
  
  try {
    console.log("--- Initial State ---");
    let res = await fetch(`${API_BASE}/api/state`);
    let state = await res.json();
    console.log(`todaysEvents: ${state.todaysEvents}, newEvents: ${state.newEvents}`);

    console.log("\n--- Triggering Wrongway Event ---");
    await fetch(`${API_BASE}/api/wrongway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Test Event' })
    });

    res = await fetch(`${API_BASE}/api/state`);
    state = await res.json();
    console.log(`todaysEvents: ${state.todaysEvents}, newEvents: ${state.newEvents}`);

    console.log("\n--- Resetting Demo ---");
    await fetch(`${API_BASE}/api/demo/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    res = await fetch(`${API_BASE}/api/state`);
    state = await res.json();
    console.log(`todaysEvents: ${state.todaysEvents}, newEvents: ${state.newEvents}`);
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

test();
