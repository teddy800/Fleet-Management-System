/**
 * Authentication Debugging Utility
 * 
 * This utility helps diagnose authentication and session issues.
 * Open browser console and run: window.authDebug()
 */

export function debugAuth() {
  console.log("🔍 ===== AUTHENTICATION DEBUG REPORT =====");
  
  // 1. Check localStorage
  console.log("\n📦 1. LocalStorage State:");
  try {
    const stored = localStorage.getItem("messob-auth");
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log("✅ Auth data found in localStorage:");
      console.log(JSON.stringify(parsed, null, 2));
    } else {
      console.log("❌ No auth data in localStorage");
    }
  } catch (err) {
    console.error("❌ Error reading localStorage:", err);
  }

  // 2. Check cookies
  console.log("\n🍪 2. Cookies:");
  const cookies = document.cookie.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('session_id='));
  if (sessionCookie) {
    console.log("✅ Session cookie found:", sessionCookie);
  } else {
    console.log("❌ No session_id cookie found");
  }
  console.log("All cookies:", cookies);

  // 3. Check Zustand store
  console.log("\n🏪 3. Zustand Store State:");
  try {
    const { useUserStore } = require('@/store/useUserStore');
    const state = useUserStore.getState();
    console.log("isAuthenticated:", state.isAuthenticated);
    console.log("user:", state.user);
    console.log("loginError:", state.loginError);
  } catch (err) {
    console.error("❌ Error reading store:", err);
  }

  // 4. Test session endpoint
  console.log("\n🌐 4. Testing Session Endpoint:");
  fetch("/web/session/get_session_info", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 1,
      params: {}
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log("✅ Session info response:");
      console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => {
      console.error("❌ Session info request failed:", err);
    });

  console.log("\n✅ ===== DEBUG REPORT COMPLETE =====");
  console.log("💡 Tips:");
  console.log("  - If localStorage has data but isAuthenticated is false, there's a hydration issue");
  console.log("  - If no session cookie, the backend session isn't being created");
  console.log("  - Check Network tab for /web/session/authenticate response");
  console.log("  - Look for CORS errors in console");
}

// Make it globally available
if (typeof window !== 'undefined') {
  window.authDebug = debugAuth;
  console.log("💡 Authentication debugger loaded. Run window.authDebug() to diagnose issues.");
}

export default debugAuth;
