(function bootstrapCeTheme() {
  var root = document.documentElement;
  var allowedThemeIds = String(root.dataset.ceThemeRegistry || '')
    .split(' ')
    .filter(Boolean);
  var isAllowed = function isAllowed(value) {
    return allowedThemeIds.indexOf(value) !== -1;
  };
  var storedTheme = '';
  var colorBlindMode = false;

  try {
    storedTheme = String(window.localStorage.getItem('ce:theme') || '')
      .trim()
      .toLowerCase();
    colorBlindMode = window.localStorage.getItem('ce:color-vision') === 'color-blind';
  } catch (_error) {
    storedTheme = '';
  }

  var deploymentTheme = String(root.dataset.ceDeploymentTheme || '')
    .trim()
    .toLowerCase();
  var themeId = isAllowed(storedTheme)
    ? storedTheme
    : isAllowed(deploymentTheme)
      ? deploymentTheme
      : 'context-engine';

  root.dataset.ceTheme = themeId;
  root.dataset.ceColorVision = colorBlindMode ? 'color-blind' : 'standard';
  root.dataset.ceThemeSource = isAllowed(storedTheme)
    ? 'user'
    : isAllowed(deploymentTheme)
      ? 'deployment'
      : 'default';
  root.style.colorScheme = themeId === 'classic-95' ? 'light' : 'dark';
})();
