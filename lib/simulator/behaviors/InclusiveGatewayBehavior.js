import {
  filterSequenceFlows, isSequenceFlow
} from '../util/ModelUtil';


export default function InclusiveGatewayBehavior(
    simulator,
    activityBehavior) {

  this._simulator = simulator;
  this._activityBehavior = activityBehavior;

  simulator.registerBehavior('bpmn:InclusiveGateway', this);
}

InclusiveGatewayBehavior.prototype.enter = function(context) {
  const {
    scope,
    element
  } = context;

  if (this._isGuaranteedToJoin(context)) {
    return this._join(context);
  }

  const {
    parent: parentScope
  } = scope;

  const sameParentScopes = this._simulator.findScopes(scope => (
    scope.parent === parentScope && scope.element !== element));

  // There are still some tokens to wait for.
  if (this._canReachAnyScope(sameParentScopes, element)) {
    return;
  }

  this._join(context);
};

InclusiveGatewayBehavior.prototype.exit = function(context) {

  const {
    element,
    scope
  } = context;

  // depends on UI to properly configure activeOutgoing for
  // each inclusive gateway

  const outgoings = filterSequenceFlows(element.outgoing);

  if (outgoings.length === 1) {
    return this._simulator.enter({
      element: outgoings[0],
      scope: scope.parent
    });
  }

  const {
    activeOutgoing
  } = this._simulator.getConfig(element);

  if (!activeOutgoing.length) {
    throw new Error('no outgoing configured');
  }

  for (const outgoing of activeOutgoing) {
    this._simulator.enter({
      element: outgoing,
      scope: scope.parent
    });
  }
};

/**
 * Number of tokens waiting at the gateway cannot be higher than the number of incoming flows.
 */
InclusiveGatewayBehavior.prototype._isGuaranteedToJoin = function(context) {
  const elementScopes = this._getElementScopes(context);

  const incomingSequenceFlows = filterSequenceFlows(context.element.incoming);

  return elementScopes.length >= incomingSequenceFlows.length;
};

InclusiveGatewayBehavior.prototype._join = function(context) {
  const elementScopes = this._getElementScopes(context);

  for (const childScope of elementScopes) {

    if (childScope !== context.scope) {

      // complete joining child scope
      this._simulator.destroyScope(childScope.complete(), context.scope);
    }
  }

  this._simulator.exit(context);
};

InclusiveGatewayBehavior.prototype._getElementScopes = function(context) {
  const {
    element,
    parent
  } = context;

  return this._simulator.findScopes({
    parent,
    element
  });
};

InclusiveGatewayBehavior.prototype._canReachAnyScope = function(scopes, currentElement, traversed = new Set()) {
  if (traversed.has(currentElement)) {
    return false;
  }

  if (anyScopeIsOnElement(scopes, currentElement)) {
    return true;
  }

  if (isSequenceFlow(currentElement)) {
    return this._canReachAnyScope(scopes, currentElement.source, traversed);
  }


  const incomingFlows = filterSequenceFlows(currentElement.incoming);

  for (const flow of incomingFlows) {
    if (this._canReachAnyScope(scopes, flow, traversed)) {
      return true;
    }
  }

  return false;
};

InclusiveGatewayBehavior.$inject = [
  'simulator',
  'activityBehavior'
];

function anyScopeIsOnElement(scopes, element) {
  return scopes.some(scope => scope.element === element);
}
