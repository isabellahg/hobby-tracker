import type { CSSProperties, ReactNode } from 'react'

/**
 * A real <form> so the keyboard's Enter/Go key submits on mobile. Android
 * keyboards with predictive text often report Enter as an "Unidentified"
 * key (keyCode 229), so `onKeyDown` checks for 'Enter' never fire there;
 * implicit form submission does. Put a `type="submit"` button inside when
 * the form has more than one input.
 */
export function EnterForm({
  onSubmit,
  children,
  id,
  className,
  style,
}: {
  onSubmit: () => void
  children: ReactNode
  /** Lets a submit button outside the form target it via `form={id}`. */
  id?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <form
      id={id}
      className={className}
      style={style}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {children}
    </form>
  )
}
