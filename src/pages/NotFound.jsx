import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/common/Logo.jsx';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';

export default function NotFound() {
  return (
    <div className="notfound">
      <div className="notfound-logo"><Logo size={34} /></div>
      <span className="notfound-code">404</span>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has moved.</p>
      <Link to="/">
        <Button icon="home">Back to home</Button>
      </Link>
    </div>
  );
}
