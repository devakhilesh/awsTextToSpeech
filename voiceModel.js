const mongoose = require("mongoose");

const voiceDataSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    voiceId: {
      type: String,
      required: true,
    },
    engine: {
      type: String,
      required: true,
    },
    lang: {
      type: String,
      default: "Any",
    },
    audioData: {
      public_id: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VoiceData", voiceDataSchema);
