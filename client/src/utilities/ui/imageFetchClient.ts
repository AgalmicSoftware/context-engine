/**
 * @module imageFetchClient
 * @description Image upload and retrieval — fetches images via the CORS proxy worker
 *              with authenticated requests and Arweave URL normalization.
 *
 * Key exports: fetchImageFromURL
 */
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { createLogger } from '../logging.js';

const sbtLog = createLogger('sbt');








export const fetchImageFromURL = async (imageUrl: string): Promise<File> => {
  if (!imageUrl || imageUrl.trim() === '') {
    sbtLog.error("No URL provided for image.");
    throw new Error("No URL provided");
  }

  try {
    const corsWorkerUrl = await getCorsProxyUrlOrThrow({
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });
    const baseUrl = corsWorkerUrl.replace(/\/+$/, '');
    const response = await fetchWorkerWithAuth(corsWorkerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        action: 'fetch_image'
      })
    }, {
      workerUrl: baseUrl,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch image';
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // ignore JSON parse error
      }

      if (response.status === 403) {
        errorMessage += ' (Permission Denied (403))';
      }

      sbtLog.error("Failed to fetch image via worker:", errorMessage);
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    if (blob.size > 10 * 1024 * 1024) {
      sbtLog.error("Image too large (>10MB)");
      throw new Error("Image too large");
    }

    const contentType = blob.type;
    if (!contentType || !contentType.startsWith('image/')) {
      sbtLog.error("URL does not point to a valid image");
      throw new Error("Invalid image type");
    }

    const fileExtension = contentType.includes('jpeg') ? 'jpg' : contentType.split('/')[1] || 'png';
    const file = new File([blob], `remote_image.${fileExtension}`, { type: contentType });
    return file;
  } catch (error) {
    sbtLog.error("Failed to fetch image via worker:", error);
    throw error;
  }
};
