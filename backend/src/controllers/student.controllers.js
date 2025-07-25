import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import Student from '../models/student.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

//register a new student

const registerStudent = asyncHandler(async (req, res) => {
	//get all the data from body (idNo , email , password , name  )

	const { idNo = '', email = '', password = '', name = '' } = req.body;

	//validate the data

	if ([idNo, email, password, name].some((field) => field.trim() === '')) {
		throw new ApiError(422, 'All fields are required');
	}

	//check whether he is already registered

	const existingStudent = await Student.findOne({
		$or: [{ isNo }, { email }],
	});

	if (existingStudent) {
		throw new ApiError(
			400,
			'Student already registered with this idNo or email'
		);
	}

	//if not create a new student

	const student = await Student.create({
		idNo,
		name,
		email,
		password,
	});
	if (!student) {
		throw new ApiError(500, 'Failed to register student');
	}

	//generate a email verification token
	const emailVerificationToken = student.createEmailVerificationToken();

	//send a email verification link to the student

	await sendEmailVerificationMail(email, emailVerificationToken);

	//set verification Token in user model
	student.emailVerificationToken = emailVerificationToken;

	student.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

	await student.save({ validateBeforeSave: false });

	//send the response

	res.status(201).json(
		new ApiResponse(
			201,
			{
				_id: student._id,
				idNo: student.idNo,
				name: student.name,
				email: student.email,
				avatar: student.avatar,
			},
			'Student registered successfully'
		)
	);
});
//verify student email
const verifyStudentEmail = asyncHandler(async (req, res) => {
	//catch the token from params

	const { token } = req.params;

	//validate Token

	if (!token || token.trim() === '') {
		throw new ApiError(422, 'Invalid Email Verification Token');
	}

	//find  a Student based on emailVerification token

	const student = await Student.findOne({
		emailVerificationToken: token,
		emailVerificationTokenExpiry: { $gt: Date.now() },
	});

	if (!student) {
		throw new ApiError(404, 'Invalid or expired email verification token');
	}

	//if its a valid token set User emailVerified to true
	student.emailVerified = true;
	student.emailVerificationToken = undefined;
	student.emailVerificationTokenExpiry = undefined;
	await student.save();

	//finally send a response
	res
		.status(200)
		.json(
			new ApiResponse(
				200,
				{ id: student.id, name: student.name, email: student.email },
				'Email verified successfully'
			)
		);
});

const loginStudent = asyncHandler(async (req, res) => {
	//get the email  or id No and Password from body

	const { idNo = '', password = '' } = req.body;
	//validate the data
	if ([idNo, password].some((field) => field.trim() === '')) {
		throw new ApiError(422, 'All fields are required');
	}
	//check if the user Exist or Not

	const student = await Student.findOne({
		$or: [
			{
				idNo: idNo,
			},
			{
				email: idNo,
			},
		],
	});

	if (!student) {
		throw new ApiError(400, 'Invalid credentials for login !');
	}

	//check email verification
	if (!student.isEmailVerified) {
		throw new ApiError(422, 'Please verify your email before logging in !');
	}

	// if exist validate Password
	const isMatch = await student.isPasswordCorrect(password);
	if (!isMatch) {
		throw new ApiError(400, 'Invalid credentials for login !');
	}
	//now set the cokkies in user Browser
	const accessToken = student.createAccessToken();
	const refreshToken = student.createRefreshToken();

	student.refreshToken = refreshToken;

	await student.save({ validateBeforeSave: false });

	const cookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: 24 * 60 * 60 * 1000 * 7, // 7 days
	};

	//finally send the response

	res
		.status(200)
		.cookie('accessToken', accessToken, cookieOptions)
		.cookie('refreshToken', refreshToken, cookieOptions)
		.json(
			new ApiResponse(
				200,
				{
					id: student._id,
					idNo: student.idNo,
					name: student.name,
					email: student.email,
					avatar: student.avatar,
					accessToken: accessToken,
					refreshToken: refreshToken,
				},
				'Student logged in successfully'
			)
		);
});
//login  a student
const getStudentProfile = asyncHandler(async (req, res) => {
	//check whether the user is authenticated or not

	const user = req?.user;
	if (!user) {
		throw new ApiError(401, 'Permission denied ! Unauthorized access');
	}
	//if authenticated simply send reponse

	res.status(200).json(
		new ApiResponse(
			200,
			{
				id: user._id,
				idNo: user.idNo,
				name: user.name,
				email: user.email,
				avatar: user.avatar,
			},
			'Student profile fetched successfully'
		)
	);
});
//logout a  student
const logoutStudent = asyncHandler(async (req, res) => {
	//check the user is authenticated or not
	const user = req?.user;
	if (!user) {
		throw new ApiError(401, 'Permission denied ! Unauthorized access');
	}

	//if yes simply logout the user

	res
		.status(200)
		.clearCookie('accessToken', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
		})
		.clearCookie('refreshToken', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
		})

		.json(new ApiResponse(200, null, 'Student logged out successfully'));
});
//update student profile pic
const updateStudentProfile = asyncHandler(async (req, res) => {
	//check whether the user is authenticated or not
	const user = req?.user;
	if (!user) {
		throw new ApiError(401, 'Permission denied ! Unauthorized access');
	}

	//get file from req.file

	const localAvatar = req?.file;

	if (!localAvatar) {
		throw new ApiError(422, 'Please upload a valid image file');
	}

	//upload it to Cloudinary
	const avatar = await uploadOnCloudinary(localAvatar.path);

	if (!avatar) {
		throw new ApiError(422, 'Failed to upload image to cloudinary');
	}

	//update avatar of Student
	const updatedStudent = await Student.findByIdAndUpdate(
		user?._id,
		{
			avatar: avatar.url,
		},
		{
			new: true,
		}
	);

	//send updated profile response

	res
		.status(200)
		.json(
			new ApiResponse(
				200,
				updatedStudent,
				'Student profile updated successfully'
			)
		);
});
//forgot password of the student
const forgotPassword = asyncHandler(async (req, res) => {
	//take email or Idno of student from body

	const { email = '' } = req.body;

	//validate Details

	if (!email || !email.trim()) {
		throw new ApiError(422, 'Email or IdNo is required');
	}

	//find the student based on email or idNo

	const student = await Student.findOne({
		$or: [{ email: email }, { idNo: email }],
	});

	if (!student) {
		throw new ApiError(404, 'Student not found with this email or idNo');
	}

	//send a reset password link to the student email

	const resetPasswordToken = student.createResetPasswordToken();
	student.resetPasswordToken = resetPasswordToken;
	student.resetPasswordTokenExpiry = Date.now() + 1000 * 60 * 60; //1 hour
	await student.save({ validateBeforeSave: false });

	await sendResetPasswordMail(student?.email, resetPasswordToken);

	//sendFinal response

	res
		.status(200)
		.json(
			new ApiResponse(
				200,
				{ success: true },
				'Reset password link sent to your email'
			)
		);
});

//reset Password of the Student

const resetPassword = asyncHandler(async (req, res) => {
	//take the token from params  and validate it

	const { token } = req.params;
	if (!token || token.trim() === '') {
		throw new ApiError(422, 'Invalid Reset Password Token');
	}
	//take the password from body and validate it
	const { newPassword = '' } = req.body;
	if (!newPassword || newPassword.trim() === '') {
		throw new ApiError(422, 'New Password  format is Invalid !');
	}
	//now based on the token find the student

	const student = await Student.findOne({
		resetPasswordToken: token,
		resetPasswordTokenExpiry: { $gt: Date.now() },
	});

	if (!student) {
		throw new ApiError(400, 'Invalid or expired reset password token');
	}

	//finally update the password  and remove all waste stuff
	student.password = newPassword;
	student.resetPasswordToken = undefined;
	student.resetPasswordTokenExpiry = undefined;
	await student.save();

	//finally Send response
	res
		.status(200)
		.json(
			new ApiResponse(200, { success: true }, 'Password reset successfully')
		);
});
