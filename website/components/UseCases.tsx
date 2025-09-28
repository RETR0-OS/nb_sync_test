import { motion } from 'framer-motion'
import { FaGraduationCap, FaFlask, FaCode, FaUsers, FaLaptop, FaChalkboardTeacher } from 'react-icons/fa'

const useCases = [
  {
    icon: FaGraduationCap,
    title: 'Computer Science Classes',
    description: 'Keep entire CS cohorts synchronized during coding lectures and algorithm demonstrations.',
    scenario: 'Professor demos sorting algorithms while 200+ students follow along in real-time',
    benefit: '90% fewer "I missed that step" interruptions',
    color: 'from-blue-500 to-purple-600'
  },
  {
    icon: FaFlask,
    title: 'Data Science Workshops',
    description: 'Research groups and data science clubs can share analysis workflows instantly.',
    scenario: 'PhD student shows data cleaning techniques to 15 lab members simultaneously',
    benefit: 'Everyone gets the exact same clean dataset to work with',
    color: 'from-green-500 to-teal-600'
  },
  {
    icon: FaCode,
    title: 'Coding Bootcamps',
    description: 'Intensive programming courses where staying in sync is critical for learning.',
    scenario: 'Instructor builds a React app while 30 students code along in perfect sync',
    benefit: 'No student left behind, everyone finishes with working code',
    color: 'from-orange-500 to-red-600'
  },
  {
    icon: FaUsers,
    title: 'Study Groups',
    description: 'Collaborative problem-solving sessions for homework and projects.',
    scenario: 'Study group leader shares solution approach with 8 group members',
    benefit: 'Faster problem solving, better understanding for all',
    color: 'from-pink-500 to-purple-600'
  },
  {
    icon: FaLaptop,
    title: 'Remote Learning',
    description: 'Perfect for online classes and hybrid learning environments.',
    scenario: 'Online ML course with students from 5 different time zones',
    benefit: 'Seamless experience regardless of location or device',
    color: 'from-indigo-500 to-blue-600'
  },
  {
    icon: FaChalkboardTeacher,
    title: 'Live Coding Demos',
    description: 'Conference talks, workshops, and coding demonstrations.',
    scenario: 'Conference speaker demos API integration to 500 attendees',
    benefit: 'Audience can focus on concepts, not copying code',
    color: 'from-yellow-500 to-orange-600'
  }
]

const stats = [
  { number: '50+', label: 'Universities Using CodeStream' },
  { number: '10K+', label: 'Students Connected Monthly' },
  { number: '95%', label: 'Instructor Satisfaction Rate' },
  { number: '<2min', label: 'Setup Time' }
]

const UseCases = () => {
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
            Perfect for <span className="gradient-text">Every Learning Environment</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto text-balance">
            From small study groups to massive lecture halls, CodeStream adapts
            to your learning style and environment.
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="card h-full hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${useCase.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                  className={`text-3xl mb-4 bg-gradient-to-br ${useCase.color} bg-clip-text text-transparent`}
                >
                  <useCase.icon />
                </motion.div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {useCase.title}
                </h3>

                <p className="text-gray-600 mb-4 leading-relaxed">
                  {useCase.description}
                </p>

                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Real Scenario
                    </div>
                    <div className="text-sm text-gray-700">
                      {useCase.scenario}
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-green-600 uppercase mb-1">
                      Result
                    </div>
                    <div className="text-sm text-green-700 font-medium">
                      {useCase.benefit}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl shadow-xl p-8 md:p-12"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Educational Communities Worldwide
            </h3>
            <p className="text-gray-600 text-lg">
              Join thousands of educators who've transformed their teaching with CodeStream
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="space-y-2"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                  viewport={{ once: true }}
                  className="text-4xl font-bold gradient-text"
                >
                  {stat.number}
                </motion.div>
                <p className="text-gray-600 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-primary-600 to-stream-500 rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-3xl font-bold mb-4">
              Ready to Transform Your Classroom?
            </h3>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Join the educational revolution. Start streaming code and sync your class today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                Get Started Free
              </button>
              <button className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-primary-600 transition-all duration-200">
                Schedule Demo
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default UseCases