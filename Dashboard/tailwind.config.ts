import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        "tertiary-container": "#9dadc6",
        "tertiary": "#505f76",
        "on-surface-variant": "#3d4a3d",
        "secondary-fixed-dim": "#bec6e0",
        "tertiary-fixed-dim": "#b7c8e1",
        "on-secondary-container": "#5c647a",
        "on-primary-container": "#004b1e",
        "on-primary-fixed-variant": "#005321",
        "surface-tint": "#006e2f",
        "on-tertiary": "#ffffff",
        "error-container": "#ffdad6",
        "secondary-fixed": "#dae2fd",
        "outline-variant": "#bccbb9",
        "surface-container-highest": "#e0e3e5",
        "surface": "#f7f9fb",
        "surface-container-low": "#f2f4f6",
        "surface-bright": "#f7f9fb",
        "surface-container": "#eceef0",
        "inverse-on-surface": "#eff1f3",
        "secondary": "#565e74",
        "on-secondary": "#ffffff",
        "surface-dim": "#d8dadc",
        "on-secondary-fixed-variant": "#3f465c",
        "surface-container-lowest": "#ffffff",
        "on-tertiary-fixed": "#0b1c30",
        "on-secondary-fixed": "#131b2e",
        "secondary-container": "#dae2fd",
        "on-primary": "#ffffff",
        "on-error-container": "#93000a",
        "background": "#f7f9fb",
        "error": "#ba1a1a",
        "primary": "#006e2f",
        "on-background": "#191c1e",
        "primary-fixed-dim": "#4ae176",
        "on-tertiary-fixed-variant": "#38485d",
        "on-tertiary-container": "#314156",
        "tertiary-fixed": "#d3e4fe",
        "surface-container-high": "#e6e8ea",
        "on-error": "#ffffff",
        "primary-container": "#22c55e",
        "primary-fixed": "#6bff8f",
        "on-surface": "#191c1e",
        "inverse-surface": "#2d3133",
        "surface-variant": "#e0e3e5",
        "on-primary-fixed": "#002109",
        "outline": "#6d7b6c",
        "inverse-primary": "#4ae176"
      },
      fontFamily: {
        "label-md": ["Inter"],
        "label-bold": ["Inter"],
        "headline-md": ["Plus Jakarta Sans"],
        "headline-lg": ["Plus Jakarta Sans"],
        "display": ["Plus Jakarta Sans"],
        "body-lg": ["Inter"],
        "body-md": ["Inter"]
      },
      fontSize: {
        "label-md": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
        "label-bold": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600"}],
        "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
        "headline-lg": ["28px", {"lineHeight": "36px", "fontWeight": "600"}],
        "display": ["36px", {"lineHeight": "44px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "body-lg": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}]
      },
      spacing: {
        "sm": "8px",
        "xs": "4px",
        "md": "16px",
        "container-max": "1280px",
        "lg": "24px",
        "gutter": "20px",
        "xl": "32px",
        "base": "4px"
      }
    }
  }
}
