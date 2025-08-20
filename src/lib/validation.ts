import { ArticleType, BlogMeta, HowToMeta, OutlineSection, ArticleDocument } from '@/types'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export function validateBlogMeta(meta: BlogMeta): ValidationResult {
  const errors: ValidationError[] = []

  if (!meta.thesis || meta.thesis.trim() === '') {
    errors.push({ field: 'thesis', message: '主張(thesis)が必要です' })
  }

  if (!meta.keyPoints || meta.keyPoints.length < 2) {
    errors.push({ field: 'keyPoints', message: '根拠(keyPoints)は2件以上必要です' })
  }

  if (!meta.faq || meta.faq.length < 3) {
    errors.push({ field: 'faq', message: 'FAQは3件以上必要です' })
  }

  if (!meta.cta || meta.cta.trim() === '') {
    errors.push({ field: 'cta', message: 'CTA(行動喚起)が必要です' })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateHowToMeta(meta: HowToMeta): ValidationResult {
  const errors: ValidationError[] = []

  if (!meta.steps || meta.steps.length < 5) {
    errors.push({ field: 'steps', message: '手順は5件以上必要です' })
  }

  if (meta.steps) {
    // Check steps have sequential order starting at 1
    const orders = meta.steps.map(step => step.order).sort((a, b) => a - b)
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        errors.push({ field: 'steps', message: '手順のorderは1から連番である必要があります' })
        break
      }
    }

    // Check each step has required fields
    meta.steps.forEach((step, index) => {
      if (!step.goal || step.goal.trim() === '') {
        errors.push({ field: `steps[${index}].goal`, message: `手順${index + 1}の目的(goal)が必要です` })
      }
      if (!step.action || step.action.trim() === '') {
        errors.push({ field: `steps[${index}].action`, message: `手順${index + 1}の操作(action)が必要です` })
      }
    })
  }

  if (!meta.timeRequired || meta.timeRequired.trim() === '') {
    errors.push({ field: 'timeRequired', message: '所要時間(timeRequired)が必要です' })
  }

  if (!meta.difficulty || !['Easy', 'Medium', 'Hard'].includes(meta.difficulty)) {
    errors.push({ field: 'difficulty', message: '難易度(difficulty)はEasy/Medium/Hardのいずれかである必要があります' })
  }

  if (!meta.troubleshooting || meta.troubleshooting.length < 1) {
    errors.push({ field: 'troubleshooting', message: 'トラブルシューティングは1件以上必要です' })
  }

  if (!meta.faq || meta.faq.length < 3) {
    errors.push({ field: 'faq', message: 'FAQは3件以上必要です' })
  }

  if (!meta.cta || meta.cta.trim() === '') {
    errors.push({ field: 'cta', message: 'CTA(行動喚起)が必要です' })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateOutline(outline: OutlineSection[], articleType: ArticleType): ValidationResult {
  const errors: ValidationError[] = []

  if (!outline || outline.length === 0) {
    errors.push({ field: 'outline', message: 'アウトラインが必要です' })
    return { isValid: false, errors }
  }

  // Check for empty headings or content
  outline.forEach((section, index) => {
    if (!section.heading || section.heading.trim() === '') {
      errors.push({ field: `outline[${index}].heading`, message: `セクション${index + 1}の見出しが空です` })
    }
  })

  if (articleType === 'BLOG_POST') {
    // Check required sections for blog post
    const requiredSections = ['intro', 'background', 'summary', 'faq', 'cta']
    const sectionTypes = outline.map(section => section.sectionType).filter(Boolean)
    
    requiredSections.forEach(required => {
      if (!sectionTypes.includes(required)) {
        errors.push({ field: 'outline', message: `ブログ記事には「${required}」セクションが必要です` })
      }
    })

    // Check minimum H2 sections
    const h2Sections = outline.filter(section => section.sectionType === 'section')
    if (h2Sections.length < 3) {
      errors.push({ field: 'outline', message: 'ブログ記事にはH2セクションが3件以上必要です' })
    }
  }

  if (articleType === 'HOW_TO_GUIDE') {
    // Check required sections for how-to guide
    const requiredSections = ['intro', 'prerequisites', 'steps', 'troubleshooting', 'faq', 'cta']
    const sectionTypes = outline.map(section => section.sectionType).filter(Boolean)
    
    requiredSections.forEach(required => {
      if (!sectionTypes.includes(required)) {
        errors.push({ field: 'outline', message: `How-Toガイドには「${required}」セクションが必要です` })
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateArticleDocument(document: ArticleDocument): ValidationResult {
  const errors: ValidationError[] = []

  // Validate outline
  const outlineValidation = validateOutline(document.outline, document.articleType)
  errors.push(...outlineValidation.errors)

  // Validate meta based on article type
  if (document.articleType === 'BLOG_POST') {
    const metaValidation = validateBlogMeta(document.meta as BlogMeta)
    errors.push(...metaValidation.errors)
  } else if (document.articleType === 'HOW_TO_GUIDE') {
    const metaValidation = validateHowToMeta(document.meta as HowToMeta)
    errors.push(...metaValidation.errors)
  }

  // Common validations
  if (!document.title || document.title.trim() === '') {
    errors.push({ field: 'title', message: 'タイトルが必要です' })
  }

  if (!document.language || !['ja', 'en'].includes(document.language)) {
    errors.push({ field: 'language', message: '言語はjaまたはenである必要があります' })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}