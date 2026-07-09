/** @file withRouterBridge.tsx */
import type { ComponentType } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

type RouterBridgeOuterProps = Record<string, unknown>;

function withRouter(Component: ComponentType<any>) {
  function ComponentWithRouterProp(props: RouterBridgeOuterProps) {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    return <Component {...props} params={params} location={location} navigate={navigate} />;
  }

  return ComponentWithRouterProp;
}

export default withRouter;
