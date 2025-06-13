const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat: {
      type: Schema.Types.ObjectId,
      refPath: "chatModel",
      required: true,
    },
    chatModel: {
      type: String,
      required: true,
      enum: ["Chat", "GroupChat","DirectMessage"], // Reference the correct chat model dynamically
    },
    content: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String, // Optional image in message
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
