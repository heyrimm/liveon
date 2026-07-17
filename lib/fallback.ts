/** API 연동 실패 시 시연/오프라인 폴백 응답. 보호자 메시지의 키워드에 맞춰 좀 더 어울리는 카테고리를 고른다. */
const FALLBACK_GROUPS: { keywords: string[]; replies: string[] }[] = [
  {
    keywords: ["미안", "죄송", "잘못"],
    replies: [
      "당신 잘못이 아니에요. 저는 함께한 시간이 정말 행복했어요.",
      "그런 말 안 해도 돼요. 저는 당신 덕분에 행복했던 기억뿐이에요.",
    ],
  },
  {
    keywords: ["보고싶", "그리워", "생각나", "생각이나"],
    replies: [
      "저도 당신이 보고 싶어요. 이렇게 이야기할 수 있어서 좋아요.",
      "저는 늘 가까이에 있는 기분이에요. 당신이 저를 떠올릴 때마다요.",
    ],
  },
  {
    keywords: ["사랑", "고마워", "고맙"],
    replies: [
      "저도 사랑해요. 함께한 모든 순간이 저한테는 선물 같았어요.",
      "고마운 건 저예요. 저를 이렇게 오래 기억해줘서요.",
    ],
  },
];

/** 특별한 키워드가 없을 때 쓰는 기본 응답 */
const DEFAULT_REPLIES = [
  "그 얘기 더 들려주세요. 우리가 함께한 날들 중에 제일 기억에 남는 순간이 있어요?",
  "저는 잘 지내고 있어요. 이렇게 저를 기억해주는 것만으로도 마음이 따뜻해져요.",
  "하고 싶었던 말이 있다면 천천히 해주세요. 저는 여기서 다 듣고 있을게요.",
  "그때 우리 정말 즐거웠죠. 또 다른 얘기도 해줄래요?",
];

/** 직전 폴백과 같은 문장이 바로 반복되지 않도록 최근 응답을 넘겨줌 */
export function pickFallbackReply(userText: string, recent: string[]): string {
  const matched = FALLBACK_GROUPS.find((g) => g.keywords.some((k) => userText.includes(k)));
  const pool = matched ? [...matched.replies, ...DEFAULT_REPLIES] : DEFAULT_REPLIES;
  const candidates = pool.filter((r) => !recent.includes(r));
  const list = candidates.length > 0 ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)];
}
