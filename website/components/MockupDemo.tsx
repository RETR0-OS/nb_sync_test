import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { FaPlay, FaUsers, FaCode, FaCheckCircle, FaToggleOn, FaToggleOff, FaChevronDown } from 'react-icons/fa'

const MockupDemo = () => {
  const [activeView, setActiveView] = useState<'teacher' | 'student'>('teacher')
  const [cellSyncStates, setCellSyncStates] = useState([true, false, true, false]) // Which cells have sync enabled
  const [studentCellSyncedTo, setStudentCellSyncedTo] = useState([0, -1, 0, -1]) // Which teacher cell each student cell is synced to (-1 = not synced)
  const [openDropdowns, setOpenDropdowns] = useState([false, false, false, false]) // Which dropdowns are open

  const teacherCells = [
    { id: 1, code: 'import pandas as pd\nimport numpy as np' },
    { id: 2, code: '# Load the dataset\ndf = pd.read_csv("data.csv")' },
    { id: 3, code: '# Data preprocessing\ndf.dropna(inplace=True)' },
    { id: 4, code: '# Analysis\ndf.describe()' }
  ]

  const getStudentCellCode = (studentCellIndex: number) => {
    const syncedToTeacherCell = studentCellSyncedTo[studentCellIndex]
    // Student gets code if synced to a teacher cell that has sync enabled
    if (syncedToTeacherCell >= 0 && cellSyncStates[syncedToTeacherCell]) {
      return teacherCells[syncedToTeacherCell].code
    }
    return `# Student Cell ${studentCellIndex + 1}\n# Click "Sync" to connect to teacher's cell`
  }

  const toggleCellSync = (cellIndex: number) => {
    const newStates = [...cellSyncStates]
    newStates[cellIndex] = !newStates[cellIndex]
    setCellSyncStates(newStates)
  }

  const toggleDropdown = (cellIndex: number) => {
    const newDropdowns = [...openDropdowns]
    newDropdowns[cellIndex] = !newDropdowns[cellIndex]
    // Close other dropdowns
    for (let i = 0; i < newDropdowns.length; i++) {
      if (i !== cellIndex) newDropdowns[i] = false
    }
    setOpenDropdowns(newDropdowns)
  }

  const syncStudentCellTo = (studentCellIndex: number, teacherCellIndex: number) => {
    const newSyncStates = [...studentCellSyncedTo]
    newSyncStates[studentCellIndex] = teacherCellIndex
    setStudentCellSyncedTo(newSyncStates)
    // Close dropdown
    const newDropdowns = [...openDropdowns]
    newDropdowns[studentCellIndex] = false
    setOpenDropdowns(newDropdowns)
  }

  return (
    <section className="section bg-white">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            See <span className="gradient-text">Cell-Level Sync</span> in Action
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto text-balance mb-8">
            Teachers control sync per cell with toggle buttons. Students select which cell to sync
            using a dropdown menu - just like the real Jupyter notebook experience.
          </p>

          {/* View Toggle */}
          <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-8">
            <button
              onClick={() => setActiveView('teacher')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                activeView === 'teacher'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FaUsers className="inline mr-2" />
              Teacher View
            </button>
            <button
              onClick={() => setActiveView('student')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                activeView === 'student'
                  ? 'bg-stream-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FaCode className="inline mr-2" />
              Student View
            </button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative"
          >
            <AnimatePresence mode="wait">
              {activeView === 'teacher' ? (
                <motion.div
                  key="teacher"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl shadow-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="bg-primary-600 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaUsers />
                      <span className="font-medium">Teacher Notebook</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>12 students connected</span>
                    </div>
                  </div>

                  {/* Notebook Cells */}
                  <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    {teacherCells.map((cell, index) => (
                      <motion.div
                        key={cell.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                        whileHover={{ shadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      >
                        {/* Cell Header with Sync Toggle */}
                        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                          <span className="text-sm font-mono text-gray-600">In [{cell.id}]:</span>
                          <div className="flex items-center gap-2">
                            <motion.button
                              onClick={() => toggleCellSync(index)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`text-xl ${
                                cellSyncStates[index]
                                  ? 'text-green-500 hover:text-green-600'
                                  : 'text-gray-400 hover:text-gray-500'
                              }`}
                            >
                              {cellSyncStates[index] ? <FaToggleOn /> : <FaToggleOff />}
                            </motion.button>
                          </div>
                        </div>

                        {/* Cell Code */}
                        <div className="bg-gray-900 p-3 font-mono text-sm">
                          <motion.pre
                            className="text-green-400 whitespace-pre-wrap"
                            animate={{
                              backgroundColor: cellSyncStates[index] ? '#10b98120' : 'transparent'
                            }}
                            transition={{ duration: 0.3 }}
                          >
                            {cell.code}
                          </motion.pre>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-green-600">
                        {cellSyncStates.filter(Boolean).length}
                      </span>
                      /{teacherCells.length} cells syncing
                    </div>
                    <div className="text-sm text-gray-600">
                      Class Code: <span className="font-mono bg-gray-200 px-2 py-1 rounded">ABC123</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="student"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl shadow-2xl overflow-visible"
                >
                  {/* Header */}
                  <div className="bg-stream-600 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaCode />
                      <span className="font-medium">Student Notebook</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Connected to ABC123</span>
                    </div>
                  </div>

                  {/* Student Notebook Cells */}
                  <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    {[0, 1, 2, 3].map((studentCellIndex) => (
                      <motion.div
                        key={studentCellIndex}
                        className="border border-gray-200 rounded-lg overflow-visible"
                        whileHover={{ shadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      >
                        {/* Cell Header with Sync Button */}
                        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                          <span className="text-sm font-mono text-gray-600">In [{studentCellIndex + 1}]:</span>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <motion.button
                                onClick={() => toggleDropdown(studentCellIndex)}
                                className={`text-xs px-3 py-1 rounded border flex items-center gap-1 ${
                                  studentCellSyncedTo[studentCellIndex] >= 0 && cellSyncStates[studentCellSyncedTo[studentCellIndex]]
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                                }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                Sync
                                <motion.div
                                  animate={{ rotate: openDropdowns[studentCellIndex] ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <FaChevronDown className="text-xs" />
                                </motion.div>
                              </motion.button>

                              <AnimatePresence>
                                {openDropdowns[studentCellIndex] && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-[100] min-w-48"
                                    style={{ maxHeight: '200px', overflowY: 'auto' }}
                                  >
                                    <div className="py-1">
                                      <div className="px-3 py-1 text-xs text-gray-500 border-b">Choose cell to sync:</div>
                                      {[0, 1, 2, 3].map((teacherCellIndex) => (
                                        <motion.button
                                          key={teacherCellIndex}
                                          onClick={() => cellSyncStates[teacherCellIndex] && syncStudentCellTo(studentCellIndex, teacherCellIndex)}
                                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                                            !cellSyncStates[teacherCellIndex]
                                              ? 'opacity-50 cursor-not-allowed bg-gray-50'
                                              : 'hover:bg-gray-50 cursor-pointer'
                                          } ${
                                            studentCellSyncedTo[studentCellIndex] === teacherCellIndex ? 'bg-stream-50 text-stream-700' : ''
                                          }`}
                                          whileHover={cellSyncStates[teacherCellIndex] ? { backgroundColor: '#f0f9ff' } : {}}
                                        >
                                          <span className={cellSyncStates[teacherCellIndex] ? 'text-gray-900' : 'text-gray-400'}>
                                            Cell {teacherCellIndex + 1}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {cellSyncStates[teacherCellIndex] ? (
                                              <FaCheckCircle className="text-green-500 text-xs" />
                                            ) : (
                                              <span className="text-xs text-gray-400 bg-gray-200 px-1 rounded">OFF</span>
                                            )}
                                            {studentCellSyncedTo[studentCellIndex] === teacherCellIndex && cellSyncStates[teacherCellIndex] && (
                                              <span className="text-xs text-stream-600 font-medium ml-1">Connected</span>
                                            )}
                                          </div>
                                        </motion.button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        {/* Cell Code */}
                        <div className="bg-gray-900 p-3 font-mono text-sm">
                          <motion.pre
                            className={`whitespace-pre-wrap ${
                              studentCellSyncedTo[studentCellIndex] >= 0 && cellSyncStates[studentCellSyncedTo[studentCellIndex]]
                                ? 'text-green-400'
                                : 'text-gray-500'
                            }`}
                            animate={{
                              backgroundColor: studentCellSyncedTo[studentCellIndex] >= 0 && cellSyncStates[studentCellSyncedTo[studentCellIndex]] ? '#10b98120' : 'transparent'
                            }}
                            transition={{ duration: 0.3 }}
                          >
                            {getStudentCellCode(studentCellIndex)}
                          </motion.pre>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Status */}
                  <div className="p-4 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 rounded-full bg-stream-500 animate-pulse"></div>
                      <span>
                        {studentCellSyncedTo.filter((syncTo, idx) => syncTo >= 0 && cellSyncStates[syncTo]).length} cells synced
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {cellSyncStates.filter(Boolean).length} teacher cells available
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right: Benefits */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {activeView === 'teacher' ? 'Teacher Control' : 'Student Experience'}
              </h3>

              {activeView === 'teacher' ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <FaToggleOn className="text-primary-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Cell-Level Control</h4>
                      <p className="text-gray-600">Toggle sync on/off for individual cells with visual feedback</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaUsers className="text-primary-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Real-time Visibility</h4>
                      <p className="text-gray-600">See exactly which cells are syncing to students</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaCheckCircle className="text-primary-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Gradual Release</h4>
                      <p className="text-gray-600">Share code progressively as lesson unfolds</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <FaCode className="text-stream-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Multiple Cells</h4>
                      <p className="text-gray-600">Each student cell can sync to any available teacher cell</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaChevronDown className="text-stream-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Sync Dropdowns</h4>
                      <p className="text-gray-600">Click "Sync" button to choose which teacher cell to connect to</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaCheckCircle className="text-stream-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Real-time Updates</h4>
                      <p className="text-gray-600">See exactly which cells are available and sync instantly</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-primary-50 to-stream-50 rounded-xl p-6">
              <h4 className="font-bold text-gray-900 mb-2">Try the Interactive Demo!</h4>
              <p className="text-gray-600 mb-4">
                {activeView === 'teacher'
                  ? 'Click the sync toggles to control which cells students can access.'
                  : 'Click "Sync" buttons on student cells to choose which teacher cell to connect to.'
                }
              </p>
              <div className="text-sm text-gray-500">
                ✨ This mirrors exactly how CodeStream works in real Jupyter notebooks!
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default MockupDemo