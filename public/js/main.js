document.addEventListener('DOMContentLoaded', () => {

  // Update footer year
  document.getElementById('footerYear').innerText = new Date().getFullYear();
  
  // Show toast
  const toast = document.getElementById('liveToast');
  if (toast) new bootstrap.Toast(toast).show();
  
  
  // Check URL on load and scroll to show nav buttons
  if (window.location.hash === '#premium-tips') {
    document.getElementById('premium-tab').click();
    scrollToTabsWithNav();
  } else if (window.location.hash === '#free-tips') {
    document.getElementById('free-tab').click();
    scrollToTabsWithNav();
  }
});

// Check URL when back/forward buttons used
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#premium-tips') {
    document.getElementById('premium-tab').click();
    scrollToTabsWithNav();
  } else if (window.location.hash === '#free-tips') {
    document.getElementById('free-tab').click();
    scrollToTabsWithNav();
  }
});

// Scroll to tabs with nav buttons visible
function scrollToTabsWithNav() {
  setTimeout(() => {
    const tabNav = document.getElementById('tipsTabs');
    if (tabNav) {
      tabNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

// For external calls
function showPremiumTips() {
  window.location.hash = '#premium-tips';
}

