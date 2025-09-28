import { motion } from 'framer-motion'
import { FaRocket, FaUsers, FaShieldAlt, FaMobile, FaBolt, FaSync } from 'react-icons/fa'

const features = [
  {
    icon: FaRocket,
    title: 'Real-time Sync',
    description: 'Code streams instantly to all students. No delays, no confusion, just seamless learning.',
    color: 'text-stream-500'
  },
  {
    icon: FaUsers,
    title: 'Role Management',
    description: 'Teachers control the flow, students receive updates. Perfect classroom hierarchy.',
    color: 'text-primary-500'
  },
  {
    icon: FaShieldAlt,
    title: 'Secure Sessions',
    description: 'Protected learning environments with class codes. Only invited students can join.',
    color: 'text-accent-500'
  },
  {
    icon: FaMobile,
    title: 'Works Everywhere',
    description: 'Jupyter, Colab, any notebook environment. No platform restrictions.',
    color: 'text-green-500'
  },
  {
    icon: FaBolt,
    title: 'Zero Setup',
    description: 'No complex installations or configurations. Start streaming in minutes.',
    color: 'text-yellow-500'
  },
  {
    icon: FaSync,
    title: 'Live Updates',
    description: 'See changes happen in real-time. Everyone stays synchronized automatically.',
    color: 'text-red-500'
  }
]

const Features = () => {
  return (
    <section className="section bg-gray-50">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Everything You Need for{' '}
            <span className="gradient-text">Collaborative Learning</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto text-balance">
            CodeStream brings your classroom together with powerful features designed
            for real-time collaboration and seamless knowledge sharing.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
              className="card group cursor-pointer"
            >
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.2 }}
                className={`${feature.color} text-3xl mb-4 group-hover:animate-bounce`}
              >
                <feature.icon />
              </motion.div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>

              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover effect overlay */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3 }}
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary-500 to-stream-500 origin-left"
              />
            </motion.div>
          ))}
        </div>

        {/* Stats section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-20 grid md:grid-cols-3 gap-8 text-center"
        >
          <div className="space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              viewport={{ once: true }}
              className="text-4xl font-bold gradient-text"
            >
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.8 }}
                viewport={{ once: true }}
              >
                99.9%
              </motion.span>
            </motion.div>
            <p className="text-gray-600 font-medium">Sync Accuracy</p>
          </div>

          <div className="space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              viewport={{ once: true }}
              className="text-4xl font-bold gradient-text"
            >
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.9 }}
                viewport={{ once: true }}
              >
                &lt;100ms
              </motion.span>
            </motion.div>
            <p className="text-gray-600 font-medium">Update Latency</p>
          </div>

          <div className="space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              viewport={{ once: true }}
              className="text-4xl font-bold gradient-text"
            >
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1 }}
                viewport={{ once: true }}
              >
                1000+
              </motion.span>
            </motion.div>
            <p className="text-gray-600 font-medium">Students Connected</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Features