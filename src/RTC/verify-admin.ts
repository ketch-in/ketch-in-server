// Muaz Khan      - www.MuazKhan.com
// MIT License    - www.WebRTC-Experiment.com/licence
// Documentation  - github.com/muaz-khan/RTCMultiConnection

// /admin/ page
export default function (params: any, config: any) {
  if (!params || !params.adminUserName || !params.adminPassword) return false;
  return (
    params.adminUserName === config.adminUserName &&
    params.adminPassword === config.adminPassword
  );
}
