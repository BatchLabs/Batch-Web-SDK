// Error subclass that comes from a fetch error
// Wraps the response object
export default class HttpError extends Error {
  public response: Response;

  public constructor(response: Response, message?: string) {
    super(message || `Response not ok. Status text: "${response.statusText}"`);
    this.response = response;
  }
}
