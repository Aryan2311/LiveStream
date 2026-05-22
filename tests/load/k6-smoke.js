import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

const baseURL = __ENV.BASE_URL || "http://localhost:8080";

export default function () {
  const response = http.get(`${baseURL}/livez`);
  check(response, {
    "livez is 200": (r) => r.status === 200,
  });
  sleep(1);
}
