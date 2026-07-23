export type ResponseHydrationInitOptions = {
  background?: boolean;
  forceArweaveFetch?: boolean;
  notifyOnCompletion?: boolean;
};

export const mergeResponseHydrationInitOptions = (
  previous: ResponseHydrationInitOptions | undefined,
  next: ResponseHydrationInitOptions | undefined,
): ResponseHydrationInitOptions => {
  return {
    background: next?.background === true && (!previous || previous.background === true),
    forceArweaveFetch: previous?.forceArweaveFetch === true || next?.forceArweaveFetch === true,
    notifyOnCompletion: previous?.notifyOnCompletion === true || next?.notifyOnCompletion === true,
  };
};
