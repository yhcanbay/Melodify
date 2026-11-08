import type { FeatureAvailability } from '../../../src/shared/mobile'
import { MobileIcon } from './MobileIcon'
import type { MobileIconName } from './MobileIcon'

export function FeaturePlaceholder({ icon, title, description, availability }: {
  icon: MobileIconName
  title: string
  description: string
  availability: FeatureAvailability
}) {
  return (
    <div className="mobile-empty">
      <span className="mobile-empty-icon"><MobileIcon name={icon} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      <p className="mobile-feature-note">{availability.message}</p>
    </div>
  )
}
