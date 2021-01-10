const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AppError = require('../utilities/AppError');

const UserSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: [true, "Provide your name"],
        maxlength: 40,
    },
    email: {
        type: String,
        required: [true, "Email is required!"],
        unique: true,
        lowercase: true,
        validate: {
            validator: validator.isEmail,
            message: "Email is not valid",
        },
    },
    password: {
        type: String,
        //required: [true, "Password is required!"],
        minlength: 8,
        select: false,
    },
    passwordConfirm: {
        type: String,
        //required: [true, "Password Confirm is required!"],
        validate: {
            validator: function(val) {
                return val === this.password;
            },
            message: "Passwords are not the same",
        },
    },
    google: {
        select: false,
        id: String,
        refreshToken: String,
        accessToken: String,
    },
    signedUpAt: {
        type: Date,
        default: Date.now(),
        select: false,
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user",
    },
    avatar: {
        type: String,
        default: "default-avatar.jpg",
    },
    passwordChangedAt: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpire: { type: Date, select: false },
    isActive: {
        type: Boolean,
        select: false,
        default: true
    },
    website: String,
    twoWayAuth: { type: Boolean, default: false },
    visibleProfile: { type: Boolean, default: true }
});

UserSchema.pre('save', function(next) {
    // if password already does exists or passed or google id is passed, we move on
    if (this.get("password") || (this.password && this.passwordConfirm) || this.google.id) {
        return next();
    }

    next(new AppError('Please provide password and passwordConfirm', 400));
})

// setting passwordChangedAt
UserSchema.pre("save", function(next) {
    // if password is not modified or the document is new
    if (!this.isModified("password") || this.isNew) return next();

    // We subtract the date because we need to make sure
    // passwordChangedAt is before the time the token was issued
    this.passwordChangedAt = Date.now() - 5 * 1000; // 5 seconds
    next();
});

// Hashing password
UserSchema.pre("save", async function(next) {
    // if password is not modified we wont hash it again
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, process.env.HASH_COST * 1);

    // deleting the passwordConfirm field
    this.passwordConfirm = undefined;
    next();
});

// Excluding the __v field from results
UserSchema.pre(/^find/, function(next) {
    this.select("-__v");
    next();
});

// method for comparing password and recived pass
UserSchema.methods.isPassCorrect = async function(candidatePass, userPass) {
    const isCorrect = await bcrypt.compare(candidatePass, userPass);
    return isCorrect;
};

// Generating reset token and sending back
UserSchema.methods.genResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString("hex");

    // hashing the token
    this.passwordResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
    this.passwordResetExpire =
        Date.now() + parseInt(process.env.RESET_TOKEN_EXPIRES_IN, 10) * 60 * 1000;

    return resetToken;
};

const User = mongoose.model("User", UserSchema);
module.exports = User;