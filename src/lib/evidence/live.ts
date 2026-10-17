/** Files taken in Docket's camera are named with this prefix; the uploader reports them as `capture=live`. */
export const LIVE_PREFIX = "docket-live-";
export const captureMethodOf = (file: File) => (file.name.startsWith(LIVE_PREFIX) ? "live" : "upload");
