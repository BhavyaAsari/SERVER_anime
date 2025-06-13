const mongoose = require("mongoose");
const { Schema } = mongoose;

function arrayLimit(val) {
  return val.length === 2;
}

const oneOnOneChatSchema = new Schema(
  {
    members: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: [arrayLimit, "Members array must have exactly two members"],
      required: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DirectMessage", oneOnOneChatSchema);
