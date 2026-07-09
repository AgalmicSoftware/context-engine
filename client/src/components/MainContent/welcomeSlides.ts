import modalPicture0 from '../../assets/img/explainer_first.png';
import modalPicture1 from '../../assets/img/beta_tab_robot.png';
import modalPicture2 from '../../assets/img/jump_transparent.png';
import modalPicture3 from '../../assets/img/seedsman_slim.jpg';
import modalPicture4 from '../../assets/img/frontliner.png';
import modalPicture5 from '../../assets/img/explainer_final.png';
import {
  COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY,
  FIRST_VISIT_STORAGE_KEY,
  ONBOARDING_COMPLETE_STORAGE_KEY,
} from '../Onboarding/onboardingConfig.js';

export type WelcomeSlideMediaButtonVariant = 'standard' | 'centered';
export type WelcomeSlideImageVariant = 'intro' | 'toolkit' | 'goals' | 'audience' | 'motivation' | 'collaborators';

export type WelcomeSlide = {
  key: string;
  title: string;
  overlayTitle: string;
  textAlign: 'center' | 'left' | 'right';
  mediaLayout?: 'default' | 'flushBottom' | 'centered';
  mediaButtonVariant: WelcomeSlideMediaButtonVariant;
  imageVariant: WelcomeSlideImageVariant;
  image: string;
  imageAlt: string;
  bulletPoints: Array<{
    bold: string;
    text: string;
  }>;
};

// Dev/QA bookmarklet: paste into the browser address bar on localhost to reopen these slides.
export const FORCE_COLD_LOAD_WELCOME_SLIDES_BOOKMARKLET = [
  `javascript:localStorage.setItem('${COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY}','true')`,
  `localStorage.removeItem('${ONBOARDING_COMPLETE_STORAGE_KEY}')`,
  `localStorage.removeItem('${FIRST_VISIT_STORAGE_KEY}')`,
  "location.href='/'",
].join(';');

export const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    key: 'intro',
    title: '',
    overlayTitle: 'Context Engine',
    textAlign: 'center',
    mediaLayout: 'flushBottom',
    mediaButtonVariant: 'standard',
    imageVariant: 'intro',
    image: modalPicture0,
    imageAlt: 'Context Engine welcome slide',
    bulletPoints: [
      { bold: '', text: '' },
      { bold: '', text: '' },
    ],
  },
  {
    key: 'toolkit',
    title: '',
    overlayTitle: 'What Is Context Engine?',
    textAlign: 'left',
    mediaLayout: 'centered',
    mediaButtonVariant: 'centered',
    imageVariant: 'toolkit',
    image: modalPicture1,
    imageAlt: 'Context Engine toolkit slide',
    bulletPoints: [
      { bold: 'A toolkit', text: 'for large-group discourse and coordination' },
      { bold: 'A place', text: 'for social voting games and experiments' },
      { bold: 'An interactive database', text: 'of AI ideas (you can improve)' },
    ],
  },
  {
    key: 'goals',
    title: 'Goals',
    overlayTitle: 'Goals',
    textAlign: 'right',
    mediaButtonVariant: 'standard',
    imageVariant: 'goals',
    image: modalPicture2,
    imageAlt: 'Context Engine goals slide',
    bulletPoints: [
      { bold: 'Open-source templates', text: 'for digital deliberation processes' },
      { bold: 'Finding top 1%', text: 'of AI policies and predictions' },
      { bold: 'Advancing Public Goods', text: 'ideation and funding' },
    ],
  },
  {
    key: 'built-to-help',
    title: 'Built To Help',
    overlayTitle: 'Built To Help',
    textAlign: 'center',
    mediaButtonVariant: 'standard',
    imageVariant: 'audience',
    image: modalPicture3,
    imageAlt: 'Context Engine people helped slide',
    bulletPoints: [
      { bold: 'The Public', text: 'access and shape AI policy discourse' },
      { bold: 'Researchers', text: 'navigate and contribute concepts' },
      { bold: 'Digital Groups', text: 'organize and monetize data' },
    ],
  },
  {
    key: 'because',
    title: 'Because',
    overlayTitle: 'Because',
    textAlign: 'left',
    mediaButtonVariant: 'centered',
    imageVariant: 'motivation',
    image: modalPicture4,
    imageAlt: 'Context Engine motivation slide',
    bulletPoints: [
      { bold: 'Info Overwhelm', text: 'multiplies other shared risks' },
      { bold: 'Preference Data', text: 'is valuable and can influence AI outcomes' },
      { bold: 'Everyone', text: 'will be affected by AI decisions' },
    ],
  },
  {
    key: 'looking-for',
    title: 'Looking For',
    overlayTitle: 'Looking For',
    textAlign: 'left',
    mediaButtonVariant: 'standard',
    imageVariant: 'collaborators',
    image: modalPicture5,
    imageAlt: 'Context Engine collaborators slide',
    bulletPoints: [
      { bold: 'Ideas', text: 'for further tools' },
      { bold: 'Cryptography Experts', text: 'for (ZK, FHE, TEE, AI, ...) features' },
      { bold: 'Collaborators', text: 'for demos and trials' },
    ],
  },
];

export const getWelcomeSlide = (index = 0): WelcomeSlide | null => {
  if (WELCOME_SLIDES.length === 0) return null;
  if (Number.isFinite(index) && index >= 0 && index < WELCOME_SLIDES.length) {
    return WELCOME_SLIDES[index];
  }
  return WELCOME_SLIDES[0];
};
