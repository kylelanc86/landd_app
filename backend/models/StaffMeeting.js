const mongoose = require('mongoose');

const staffMeetingSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  meetingLeaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    default: null
  },
  fileData: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

staffMeetingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

staffMeetingSchema.index({ date: -1 });

module.exports = mongoose.model('StaffMeeting', staffMeetingSchema);
