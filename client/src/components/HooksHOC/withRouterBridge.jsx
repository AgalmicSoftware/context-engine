/** @file withRouterBridge.jsx */
import { BrowserRouter, useLocation, useNavigate, useParams } from "react-router-dom";
import { createLogger } from '../../utilities/logging';

const log = createLogger('general');

  function withRouter(Component) {
    function ComponentWithRouterProp(props) {

      const params = useParams()
      const navigate = useNavigate()
      const location = useLocation()

      return (
          <Component
            {...props}
            params={params}
            location={location}
            navigate={navigate}
          />
      );
    }

    return ComponentWithRouterProp;
  }

  export default withRouter;
