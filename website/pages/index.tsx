import Head from 'next/head'
import Image from 'next/image'
import { motion } from 'framer-motion'
import Hero from '../components/Hero'
import Features from '../components/Features'
import MockupDemo from '../components/MockupDemo'
import UseCases from '../components/UseCases'
import HowItWorks from '../components/HowItWorks'
import { FaGithub, FaTwitter, FaEnvelope, FaHeart } from 'react-icons/fa'

export default function Home() {
  return (
    <>
      <Head>
        <title>CodeStream - Real-time Notebook Synchronization for Education</title>
        <meta name="description" content="Stream your code, sync your class. CodeStream enables real-time notebook synchronization for collaborative learning in Jupyter and Google Colab. Perfect for college classes, coding bootcamps, and study groups." />
        <meta name="keywords" content="jupyter, colab, notebook, synchronization, education, coding, classroom, collaborative learning, real-time" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Open Graph */}
        <meta property="og:title" content="CodeStream - Real-time Notebook Synchronization" />
        <meta property="og:description" content="Stream your code, sync your class. Real-time notebook synchronization for collaborative learning." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://codestream.education" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="CodeStream - Real-time Notebook Synchronization" />
        <meta name="twitter:description" content="Stream your code, sync your class. Perfect for educational environments." />

        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200"
        >
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="CodeStream Logo"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-xl font-bold gradient-text">CodeStream</span>
              </motion.div>

              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Features
                </a>
                <a href="#demo" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Demo
                </a>
                <a href="#use-cases" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Use Cases
                </a>
                <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">
                  How It Works
                </a>
              </div>

              <div className="flex items-center gap-4">
                <motion.a
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://github.com/your-username/codestream"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <FaGithub className="text-xl" />
                </motion.a>
                <button className="btn-primary text-sm px-4 py-2">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Main Content */}
        <main>
          <Hero />

          <section id="features">
            <Features />
          </section>

          <section id="demo">
            <MockupDemo />
          </section>

          <section id="use-cases">
            <UseCases />
          </section>

          <section id="how-it-works">
            <HowItWorks />
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-gray-900 text-white">
          <div className="container py-16">
            <div className="grid md:grid-cols-4 gap-8">
              {/* Logo & Description */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <Image
                      src="/logo.png"
                      alt="CodeStream Logo"
                      width={32}
                      height={32}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-xl font-bold">CodeStream</span>
                </div>
                <p className="text-gray-400 mb-6 max-w-md">
                  Real-time notebook synchronization for collaborative learning.
                  Transforming education one classroom at a time.
                </p>
                <div className="flex items-center gap-4">
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    href="https://github.com/your-username/codestream"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FaGithub className="text-xl" />
                  </motion.a>
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    href="https://twitter.com/codestream"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FaTwitter className="text-xl" />
                  </motion.a>
                  <motion.a
                    whileHover={{ scale: 1.1 }}
                    href="mailto:hello@codestream.education"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FaEnvelope className="text-xl" />
                  </motion.a>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="font-bold mb-4">Quick Links</h4>
                <div className="space-y-2">
                  <a href="#features" className="block text-gray-400 hover:text-white transition-colors">
                    Features
                  </a>
                  <a href="#demo" className="block text-gray-400 hover:text-white transition-colors">
                    Live Demo
                  </a>
                  <a href="#use-cases" className="block text-gray-400 hover:text-white transition-colors">
                    Use Cases
                  </a>
                  <a href="#how-it-works" className="block text-gray-400 hover:text-white transition-colors">
                    How It Works
                  </a>
                </div>
              </div>

              {/* Resources */}
              <div>
                <h4 className="font-bold mb-4">Resources</h4>
                <div className="space-y-2">
                  <a href="/docs" className="block text-gray-400 hover:text-white transition-colors">
                    Documentation
                  </a>
                  <a href="/tutorial" className="block text-gray-400 hover:text-white transition-colors">
                    Tutorial
                  </a>
                  <a href="/support" className="block text-gray-400 hover:text-white transition-colors">
                    Support
                  </a>
                  <a href="/community" className="block text-gray-400 hover:text-white transition-colors">
                    Community
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-gray-400 text-sm">
                © 2024 CodeStream. Made with{' '}
                <FaHeart className="inline text-red-500 mx-1" />
                for educators worldwide.
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <a href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
                <a href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}