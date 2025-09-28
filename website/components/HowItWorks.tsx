import { motion } from 'framer-motion'
import { FaPlay, FaUsers, FaBolt, FaArrowRight } from 'react-icons/fa'

const steps = [
  {
    step: 1,
    icon: FaPlay,
    title: 'Teacher Creates Stream',
    description: 'Start a new session and get a unique class code to share with students.',
    details: [
      'One-click session creation',
      'Secure class code generation',
      'Real-time connection tracking'
    ],
    color: 'from-primary-500 to-primary-600'
  },
  {
    step: 2,
    icon: FaUsers,
    title: 'Students Join Stream',
    description: 'Students enter the class code and instantly connect to the learning session.',
    details: [
      'Simple code entry',
      'Automatic synchronization',
      'Cross-platform compatibility'
    ],
    color: 'from-stream-500 to-stream-600'
  },
  {
    step: 3,
    icon: FaBolt,
    title: 'Code Flows Instantly',
    description: 'Real-time synchronization begins - every student stays perfectly in sync.',
    details: [
      'Sub-100ms latency',
      'Automatic conflict resolution',
      'Seamless learning experience'
    ],
    color: 'from-accent-500 to-accent-600'
  }
]

const HowItWorks = () => {
  return (
    <section className="section bg-white">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            How <span className="gradient-text">CodeStream</span> Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto text-balance">
            Getting started is incredibly simple. Just three steps to transform
            your classroom into a synchronized learning environment.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Lines */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-200 via-stream-200 to-accent-200"></div>

          <div className="grid lg:grid-cols-3 gap-12 relative">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative text-center"
              >
                {/* Step Number Circle */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={`relative z-10 w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br ${step.color} text-white flex items-center justify-center text-2xl font-bold shadow-lg`}
                >
                  {step.step}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 + index * 0.2 }}
                    viewport={{ once: true }}
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent"
                  />
                </motion.div>

                {/* Arrow (for larger screens) */}
                {index < steps.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 1 + index * 0.2 }}
                    viewport={{ once: true }}
                    className="hidden lg:block absolute top-8 -right-6 text-gray-300 text-2xl z-0"
                  >
                    <FaArrowRight />
                  </motion.div>
                )}

                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                  className={`text-4xl mb-4 bg-gradient-to-br ${step.color} bg-clip-text text-transparent`}
                >
                  <step.icon />
                </motion.div>

                {/* Content */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 + index * 0.2 }}
                  viewport={{ once: true }}
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {step.title}
                  </h3>

                  <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                    {step.description}
                  </p>

                  <div className="space-y-2">
                    {step.details.map((detail, detailIndex) => (
                      <motion.div
                        key={detailIndex}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 + index * 0.2 + detailIndex * 0.1 }}
                        viewport={{ once: true }}
                        className="flex items-center justify-center gap-2 text-sm text-gray-500"
                      >
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${step.color}`} />
                        <span>{detail}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Demo Flow */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 md:p-12"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              See It in Action
            </h3>
            <p className="text-gray-600">
              Watch how easy it is to get started with CodeStream
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Teacher */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white rounded-xl p-6 shadow-lg"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaPlay className="text-primary-600 text-xl" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Teacher</h4>
                <p className="text-sm text-gray-600 mb-4">
                  "Let me start a session for today's Python workshop"
                </p>
                <div className="bg-primary-50 rounded-lg p-3">
                  <div className="text-xs text-primary-600 font-mono">
                    Class Code: XYZ789
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Student */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white rounded-xl p-6 shadow-lg"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-stream-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaUsers className="text-stream-600 text-xl" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Student</h4>
                <p className="text-sm text-gray-600 mb-4">
                  "I'll join with the code the professor shared"
                </p>
                <div className="bg-stream-50 rounded-lg p-3">
                  <div className="text-xs text-stream-600">
                    ✅ Connected to XYZ789
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sync */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white rounded-xl p-6 shadow-lg"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaBolt className="text-accent-600 text-xl" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Magic!</h4>
                <p className="text-sm text-gray-600 mb-4">
                  "Everyone's notebooks are now perfectly synchronized"
                </p>
                <div className="bg-accent-50 rounded-lg p-3">
                  <div className="text-xs text-accent-600">
                    ⚡ Real-time sync active
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
            className="text-center mt-8"
          >
            <button className="btn-primary">
              Try CodeStream Now
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default HowItWorks