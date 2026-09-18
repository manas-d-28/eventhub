const Event = require('../models/Event');

const handleDatabaseError = (res, error, fallbackMessage) => {
  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid event id' });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
};

const createEvent = async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, createdBy: req.user.userId });
    return res.status(201).json({ event });
  } catch (error) {
    return handleDatabaseError(res, error, 'Unable to create event');
  }
};

const listEvents = async (req, res) => {
  const { date, venue } = req.query;
  const filter = {};

  if (date) {
    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid date filter' });
    }

    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.date = { $gte: start, $lt: end };
  }

  if (venue) {
    filter.venue = { $regex: venue, $options: 'i' };
  }

  try {
    const events = await Event.find(filter).sort({ date: 1 });
    return res.json({ events });
  } catch (error) {
    return handleDatabaseError(res, error, 'Unable to list events');
  }
};

const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ event });
  } catch (error) {
    return handleDatabaseError(res, error, 'Unable to fetch event');
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    Object.assign(event, req.body);
    await event.save();
    return res.json({ event });
  } catch (error) {
    return handleDatabaseError(res, error, 'Unable to update event');
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(res, error, 'Unable to delete event');
  }
};

module.exports = { createEvent, deleteEvent, getEvent, listEvents, updateEvent };
