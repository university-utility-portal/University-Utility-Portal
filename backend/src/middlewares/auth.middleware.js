import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const isLoggedIn = asyncHandler(async (req, res, next) => {
	const token =
		req.cookies.accessToken ||
		req.headers['Authorization'].replace('Bearer ', '');
	if (!token) {
		throw new ApiError(401, 'UnAuthorized access ! Please login to continue');
	}
	try {
		const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		const student = await Student.findById(decodedToken.id).select(
			'-password -emailVerificationToken -emailVerificationTokenExpiry -resetPasswordToken -resetPasswordTokenExpiry '
		);

		req.user = student;
	} catch (error) {
		throw new ApiError(
			401,
			'Invalid or expired Jwt token ! Please login again'
		);
	}
	next();
});

const isAuthorised = (roles = []) =>
	asyncHandler(async (req, res, next) => {
		const student = req?.user;

		if (!student) {
			throw new ApiError(403, 'UnAuthorised user !');
		}

		if (roles.includes(student.role)) {
			return next();
		} else {
			throw new ApiError(403, 'Your not Authorised for this action !');
		}
	});

export { isLoggedIn, isAuthorised };
