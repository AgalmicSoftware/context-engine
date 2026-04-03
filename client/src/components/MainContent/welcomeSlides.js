import modalPicture0 from '../../assets/img/explainer_first.png';
import modalPicture1 from '../../assets/img/beta_tab_robot.png';
import modalPicture2 from '../../assets/img/jump.png';
import modalPicture3 from '../../assets/img/seedsman_slim.jpg';
import modalPicture4 from '../../assets/img/frontliner.png';
import modalPicture5 from '../../assets/img/explainer_final.png';

export const WELCOME_SLIDES = [
  {
    key: 'intro',
    title: '',
    overlayTitle: 'Context Engine',
    textAlign: 'center',
    mediaLayout: 'flushBottom',
    buttonStyleId: 'siteExplainer',
    imageStyleId: 'greetingImage',
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
    buttonStyleId: 'siteExplainerMultiply',
    imageStyleId: 'betaViewerRobot',
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
    buttonStyleId: 'siteExplainer',
    imageStyleId: 'betaViewerShip',
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
    buttonStyleId: 'siteExplainer',
    imageStyleId: 'betaViewerSeedsman',
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
    buttonStyleId: 'siteExplainerMultiply',
    imageStyleId: 'frontlinerImage',
    image: modalPicture4,
    imageAlt: 'Context Engine motivation slide',
    bulletPoints: [
      { bold: 'Info Overwhelm', text: 'multiplies other shared risks' },
      { bold: 'Opinion Data', text: 'can influence AI outcomes' },
      { bold: 'Everyone', text: 'will be affected by AI decisions' },
    ],
  },
  {
    key: 'looking-for',
    title: 'Looking For',
    overlayTitle: 'Looking For',
    textAlign: 'left',
    buttonStyleId: 'siteExplainer',
    imageStyleId: 'finalImage',
    image: modalPicture5,
    imageAlt: 'Context Engine collaborators slide',
    bulletPoints: [
      { bold: 'Ideas', text: 'for further tools' },
      { bold: 'Cryptography Experts', text: 'for (ZK, FHE, TEE, AI, ...) features' },
      { bold: 'Collaborators', text: 'for demos and trials' },
    ],
  },
];

export const getWelcomeSlide = (index = 0) => {
  if (WELCOME_SLIDES.length === 0) return null;
  if (Number.isFinite(index) && index >= 0 && index < WELCOME_SLIDES.length) {
    return WELCOME_SLIDES[index];
  }
  return WELCOME_SLIDES[0];
};
