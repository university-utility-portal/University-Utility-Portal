import { connect } from "mongoose";
import { DATA_BASE_NAME } from "../constants.js";

//Db connection function
const connectDb = async () => {
  try {
    const dbInstance = await connect(
      `${process.env.MONGOOSE_URL}/${DATA_BASE_NAME}`
    );
    console.log("DB connected ", dbInstance.connection.host);
  } catch (err) {
    console.log("Error : while connecting to db !");
    process.exit(1);
  }
};

export default connectDb;
