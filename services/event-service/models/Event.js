const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    totalSeats: { type: Number, required: true, min: 1 },
    availableSeats: { type: Number, required: true, min: 0 },
    createdBy: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

eventSchema.path('availableSeats').validate(function (value) {
  return value <= this.totalSeats;
}, 'Available seats cannot exceed total seats');

module.exports = mongoose.model('Event', eventSchema);
