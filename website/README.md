# CodeStream Landing Page

A modern, interactive landing page for CodeStream - real-time notebook synchronization for collaborative learning.

## Overview

This is a Next.js-based landing page showcasing CodeStream's features and benefits for educational environments. Built with TypeScript, Tailwind CSS, and Framer Motion for smooth animations.

## Features

- 🎨 **Modern Design**: Clean, professional design with gradient accents
- ⚡ **Interactive Animations**: Smooth animations and micro-interactions
- 📱 **Responsive**: Mobile-first design that works on all devices
- 🎯 **Targeted Content**: Focused on college clubs, classes, and educational use cases
- 🚀 **Performance**: Optimized for fast loading and smooth experience

## Components

- **Hero**: Eye-catching intro with streaming code animations
- **Features**: Key benefits with animated icons and stats
- **MockupDemo**: Interactive teacher/student flow demonstration
- **UseCases**: Real-world scenarios for different educational environments
- **HowItWorks**: Simple 3-step process visualization

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Development Commands

```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Technology Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom animations
- **Animations**: Framer Motion for smooth interactions
- **Icons**: React Icons for consistent iconography
- **Deployment**: Ready for Vercel, Netlify, or any static hosting

## Customization

### Colors & Branding

Update the theme colors in `tailwind.config.js`:

```javascript
colors: {
  primary: { /* Blue theme for trust/technology */ },
  stream: { /* Cyan theme for flow/streaming */ },
  accent: { /* Purple theme for innovation */ }
}
```

### Content

- Update hero content in `components/Hero.tsx`
- Modify feature descriptions in `components/Features.tsx`
- Customize use cases in `components/UseCases.tsx`
- Edit process steps in `components/HowItWorks.tsx`

### Animations

All animations use Framer Motion. Customize timing and effects in individual component files.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repository to Vercel
3. Deploy automatically

### Static Export

```bash
npm run build
# Upload `out` folder to any static hosting
```

## Performance

- Optimized images and lazy loading
- Minimal JavaScript bundle
- Efficient CSS with Tailwind's purging
- Fast page transitions with Next.js

## SEO & Analytics

- Complete meta tags and Open Graph support
- Semantic HTML structure
- Performance optimized for Core Web Vitals
- Ready for Google Analytics integration

## License

This landing page is part of the CodeStream project. Built for educational use and community learning.

## Support

For issues or customization help:
- Check the CodeStream main repository
- Create an issue in the project repository
- Contact the development team

---

**Note**: This landing page is designed to showcase CodeStream's capabilities for collaborative learning in educational environments.