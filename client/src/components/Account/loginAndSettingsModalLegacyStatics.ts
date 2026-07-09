import PropTypes from 'prop-types';

type LegacyStaticComponent = object & {
  defaultProps?: unknown;
  displayName?: string;
  propTypes?: unknown;
};

export const assignLoginAndSettingsModalLegacyStatics = (
  LoginAndSettingsModal: LegacyStaticComponent,
  LoginAndSettingsModalWithWagmiHooks: LegacyStaticComponent,
) => {
  LoginAndSettingsModal.displayName = 'LoginAndSettingsModal';

  LoginAndSettingsModal.propTypes = {
    loginModalToggled: PropTypes.bool,
    loginInProgress: PropTypes.bool,
    loginComplete: PropTypes.bool,
    provider: PropTypes.string,
    account: PropTypes.string,
    network: PropTypes.object,
    demoMode: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    demoSurfaceMode: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf([null])]),
    changeAccount: PropTypes.func.isRequired,
    toggleLoginModal: PropTypes.func.isRequired,
    updateLoginInfo: PropTypes.func.isRequired,
    toggleDemoMode: PropTypes.func.isRequired,
    setDemoSurfaceMode: PropTypes.func,
    toggleTooltips: PropTypes.func,
    changeFocusedTab: PropTypes.func.isRequired,
    wagmiProvider: PropTypes.object,
    wagmiNetwork: PropTypes.object,
    wagmiAddress: PropTypes.string,
    wagmiBalance: PropTypes.object,
    openConnectModal: PropTypes.func,
    focusedTab: PropTypes.number,
    activeSessionSlug: PropTypes.string,
    primarySessionExplicit: PropTypes.bool,
    selectedSessionScope: PropTypes.string,
    selectedSessionSlugs: PropTypes.arrayOf(PropTypes.string),
    tooltipsEnabled: PropTypes.bool,
    changeActiveSessionSlug: PropTypes.func,
    updateGlobalSessionSelection: PropTypes.func,
  };

  LoginAndSettingsModal.defaultProps = {
    setDemoSurfaceMode: () => {},
    toggleTooltips: () => {},
    tooltipsEnabled: true,
    changeActiveSessionSlug: () => {},
    updateGlobalSessionSelection: () => {},
    demoSurfaceMode: true,
    primarySessionExplicit: false,
    selectedSessionScope: 'active',
    selectedSessionSlugs: [],
  };

  LoginAndSettingsModalWithWagmiHooks.displayName = 'LoginAndSettingsModal';
};
