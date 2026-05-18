export const LEVELS = ['중등', '고등'] as const
export const SUBJECTS = ['국어', '수학', '영어', '사회', '과학'] as const
export const CATEGORIES = [
  '자습서',
  '평가문제집',
  '단어장',
  '유형서',
  '기출문제집',
  '모의고사',
] as const

export type Level = (typeof LEVELS)[number]
export type Subject = (typeof SUBJECTS)[number]
export type Category = (typeof CATEGORIES)[number]
