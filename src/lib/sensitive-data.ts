// Deliberately bounded pattern checks, not a complete personal-data classifier.
export function safePublicText(value: string) {
  const v = value.normalize("NFKC");
  return !/(?:\d{6}\s*-?\s*[1-8]\d{6})|(?:01[016789][\s.-]?\d{3,4}[\s.-]?\d{4})|(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(
    v,
  );
}
export function safeMetricName(value: string) {
  return !/(^|_)(age|birth|gender|sex|sexual|race|ethnicity|religion|political|health|medical|face|facial|biometric|phone|email|address|emotion)(_|$)/i.test(
    value,
  );
}
