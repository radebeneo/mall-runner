// Image imports resolve to a URL string (Vite's asset handling). The web app gets the same
// typing from `vite/client`; this package has no Vite types of its own.
declare module '*.webp' {
  const url: string;
  export default url;
}
