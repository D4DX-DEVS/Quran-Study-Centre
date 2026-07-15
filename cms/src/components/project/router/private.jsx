import { Route } from "react-router-dom";
import ExamConsolidationByCentre from "../pages/examConsolidationByCentre/index.jsx";

const CustomPrivateRoute = () => [
  // <Route key="landing-page" path="/landing-page/:id" element={<Landing key={"landing-page"}/>} />
  <Route key="exam-consolidation-by-centre" path="/exam-consolidation-by-centre" element={<ExamConsolidationByCentre />} />,
];
export default CustomPrivateRoute;
