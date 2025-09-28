import { motion } from 'framer-motion'
import { FaPlay, FaCode, FaUsers } from 'react-icons/fa'
import { useEffect, useState } from 'react'

const codeSnippets = [
  'import pandas as pd',
  'def analyze_data():',
  'for i in range(10):',
  'plt.plot(x, y)',
  'model.fit(X_train, y_train)',
  'print("Hello, Class!")'
]

const Hero = () => {
  const [visibleParticles, setVisibleParticles] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setVisibleParticles(prev => (prev + 1) % 4)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-primary-50 via-stream-50 to-accent-50 overflow-hidden">
      {/* Animated background particles - only render on client */}
      {mounted && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-primary-200 font-mono text-sm opacity-30"
              style={{
                top: `${20 + i * 15}%`,
                fontSize: '12px'
              }}
              animate={{
                x: [-100, 1300], // Fixed width instead of window.innerWidth
                opacity: i <= visibleParticles ? [0, 1, 1, 0] : 0
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                delay: i * 2,
                ease: "linear"
              }}
            >
              {codeSnippets[i]}
            </motion.div>
          ))}
        </div>
      )}

      <div className="container relative z-10 flex items-center min-h-screen">
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-stream-100 text-stream-700 px-4 py-2 rounded-full text-sm font-medium"
            >
              <FaPlay className="text-xs" />
              Now Streaming Live
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight"
            >
              Stream Your{' '}
              <span className="gradient-text">Code</span>,<br />
              Sync Your{' '}
              <span className="gradient-text">Class</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-xl text-gray-600 max-w-lg text-balance"
            >
              Real-time notebook synchronization for collaborative learning.
              Keep your entire class on the same page with CodeStream.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button className="btn-primary inline-flex items-center gap-2">
                <FaPlay />
                Start Streaming
              </button>
              <button className="btn-secondary inline-flex items-center gap-2">
                <FaCode />
                See It in Action
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="flex items-center gap-6 text-sm text-gray-500"
            >
              <div className="flex items-center gap-2">
                <FaUsers />
                <span>Perfect for college classes</span>
              </div>
              <div className="flex items-center gap-2">
                <FaCode />
                <span>Works with Jupyter & Colab</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right visual */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="relative"
          >
            <div className="relative bg-white rounded-2xl shadow-2xl p-6 transform rotate-0 hover:rotate-3 transition-transform duration-500">
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-400 ml-2">notebook.ipynb</span>
                </div>
                <div className="space-y-2">
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-green-400"
                  >
                    In [1]: import pandas as pd
                  </motion.div>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    className="text-blue-400"
                  >
                    In [2]: df = pd.read_csv('data.csv')
                  </motion.div>
                  <motion.div
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                    className="text-purple-400"
                  >
                    In [3]: df.head()
                  </motion.div>
                </div>
              </div>

              {/* Streaming indicator */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-3 -right-3 bg-stream-500 text-white px-3 py-1 rounded-full text-xs font-bold"
              >
                LIVE
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-gray-400"
      >
        <div className="w-6 h-10 border-2 border-gray-300 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-gray-400 rounded-full mt-2"></div>
        </div>
      </motion.div>
    </section>
  )
}

export default Hero